/* global Xrm */
var HT = window.HT || {};

HT.SurveyAutomation = (function () {
    "use strict";

    function cleanId(value) {
        return String(value || "").replace(/[{}]/g, "");
    }

    function value(formContext, logicalName) {
        var attribute = formContext.getAttribute(logicalName);
        return attribute ? attribute.getValue() : null;
    }

    function textValue(formContext, logicalName) {
        return String(value(formContext, logicalName) || "").trim().toLowerCase();
    }

    function isOpenStatus(status) {
        return ["requested", "draft", "sent"].indexOf(status) >= 0;
    }

    function dateTime(valueToParse) {
        if (valueToParse === null || valueToParse === undefined || valueToParse === "") return NaN;
        if (typeof valueToParse.getTime === "function") return valueToParse.getTime();
        return new Date(valueToParse).getTime();
    }

    function installationValidation(formContext) {
        if (!formContext || !formContext.ui || formContext.ui.getFormType() === 1) {
            return { valid: false, message: "Save the Order Confirmation before sending the installation confirmation." };
        }
        if (!value(formContext, "ht_customercontact")) {
            return { valid: false, message: "Provide Customer Name on the Order Confirmation before sending the installation confirmation." };
        }

        var start = dateTime(value(formContext, "ht_installationstart"));
        if (!Number.isFinite(start)) {
            return { valid: false, message: "Provide a valid Installation Date/Time before sending the installation confirmation." };
        }

        var finish = dateTime(value(formContext, "ht_installationfinish"));
        if (!Number.isFinite(finish)) {
            return { valid: false, message: "Provide a valid Installation Finish Date/Time before sending the installation confirmation." };
        }
        if (finish <= start) {
            return { valid: false, message: "Installation Finish Date/Time must be later than Installation Date/Time." };
        }

        var status = textValue(formContext, "ht_installationresponsekey");
        if (isOpenStatus(status) || status === "accepted") {
            return { valid: false, message: "An installation confirmation is already " + status + ". It cannot be sent again until that request is failed, declined, reschedule requested, or expired." };
        }
        return { valid: true, message: "" };
    }

    async function saveIfDirty(formContext) {
        if (formContext.data.entity.getIsDirty()) {
            await formContext.data.save();
        }
    }

    function hasSurveyPrerequisites(formContext) {
        return formContext && formContext.ui && formContext.ui.getFormType() !== 1 &&
            Boolean(value(formContext, "parentcontactid")) &&
            Boolean(value(formContext, "ht_region")) &&
            Boolean(value(formContext, "ht_surveyor"));
    }

    function canRequestSurvey(primaryControl) {
        try {
            var formContext = primaryControl;
            return hasSurveyPrerequisites(formContext) && !isOpenStatus(textValue(formContext, "ht_surveyautomationstatuskey"));
        } catch (_error) {
            return false;
        }
    }

    function canRequestInstallation(primaryControl) {
        try {
            return installationValidation(primaryControl).valid;
        } catch (_error) {
            return false;
        }
    }

    async function surveyRequestValidation(formContext, opportunityId) {
        if (!hasSurveyPrerequisites(formContext)) {
            return { valid: false, message: "Save the Opportunity and provide Contact, Region and Surveyor." };
        }

        var record = await Xrm.WebApi.retrieveRecord(
            "opportunity",
            opportunityId,
            "?$select=ht_surveyautomationstatuskey,ht_surveytokenid"
        );
        var status = String(record.ht_surveyautomationstatuskey || "").trim().toLowerCase();
        var hasSession = Boolean(String(record.ht_surveytokenid || "").trim());
        if (isOpenStatus(status) || (status === "accepted" && hasSession)) {
            return {
                valid: false,
                message: "A survey is already " + status + ". Open the existing survey or explicitly reset/expire it before sending another one."
            };
        }
        return { valid: true, message: "" };
    }

    async function requestSurvey(primaryControl) {
        var formContext = primaryControl;
        try {
            Xrm.Utility.showProgressIndicator("Requesting customer survey...");
            await saveIfDirty(formContext);
            var opportunityId = cleanId(formContext.data.entity.getId());
            var validation = await surveyRequestValidation(formContext, opportunityId);
            if (!validation.valid) throw new Error(validation.message);

            await Xrm.WebApi.updateRecord(
                "opportunity",
                opportunityId,
                { ht_surveysendrequestedon: new Date().toISOString() }
            );
            await formContext.data.refresh(false);
            await Xrm.Navigation.openAlertDialog({
                text: "Survey request accepted. Refresh shortly to see Sent or Failed status."
            });
        } catch (error) {
            await Xrm.Navigation.openErrorDialog({ message: error.message || String(error) });
        } finally {
            Xrm.Utility.closeProgressIndicator();
        }
    }

    async function requestInstallation(primaryControl) {
        var formContext = primaryControl;
        try {
            await saveIfDirty(formContext);
            var validation = installationValidation(formContext);
            if (!validation.valid) throw new Error(validation.message);

            Xrm.Utility.showProgressIndicator("Requesting installation confirmation...");
            await Xrm.WebApi.updateRecord(
                "salesorder",
                cleanId(formContext.data.entity.getId()),
                { ht_installationconfirmationrequestedon: new Date().toISOString() }
            );
            await formContext.data.refresh(false);
            await Xrm.Navigation.openAlertDialog({
                text: "Installation confirmation request accepted. Refresh shortly to see Sent or Failed status."
            });
        } catch (error) {
            await Xrm.Navigation.openErrorDialog({ message: error.message || String(error) });
        } finally {
            Xrm.Utility.closeProgressIndicator();
        }
    }

    async function refresh(primaryControl) {
        await primaryControl.data.refresh(false);
    }

    return {
        canRequestSurvey: canRequestSurvey,
        canRequestInstallation: canRequestInstallation,
        requestSurvey: requestSurvey,
        requestInstallation: requestInstallation,
        refresh: refresh
    };
})();

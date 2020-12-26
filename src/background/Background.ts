import { TestSuite } from "../domain/TestSuite";
import { CommunicationMessage, CommunicationRequest, CommunicationResponse } from "../domain/Communication";
import { getStoredPageState, setStoredPageState, getStoredTestSuite, setStoredTestSuite } from "../domain/Storage";

const processMessageToPage = async (request: CommunicationRequest) => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, request);
    });
};

const processMessageToPopUp = async (request: CommunicationResponse) => {
    const pageState = await getStoredPageState();
    const testSuite = await getStoredTestSuite();

    switch (request.operation) {
        case "startRecording":
            // This will set the test to which we currently record
            pageState.recordingToTest = request.data;
            break;
        case "stopRecording": 
            if (request.success) {
                pageState.recordingToTest = undefined;
            }
            break;
        case "getFormState":
            pageState.formState = request.data;
            break;
        case "formEvent":
            const activeTest = testSuite.tests.find(t => t.id === pageState.recordingToTest);
            activeTest && activeTest.actions.push(request.data);
            break;
    }

    await setStoredPageState(pageState);
    await setStoredTestSuite(testSuite);

    console.log("Backend script received message for popup: " + JSON.stringify(request));
    chrome.runtime.sendMessage("ping");
};

// Add event listener for extension events
chrome.runtime.onMessage.addListener((request: CommunicationMessage, sender, sendResponse) => {
    switch(request.recipient) {
        case "popup":
            processMessageToPopUp(request as CommunicationResponse);
            break;
        case "page":
            console.log("Backend script received message for page: " + JSON.stringify(request));
            processMessageToPage(request as CommunicationRequest);
            break;
        default:
            break;
        }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        if (!tabs[0] || tabs[0].id !== tabId) {
            return;
        }

        const state = await getStoredPageState();
        state.recordingToTest = undefined;
        state.formState = undefined;

        await setStoredPageState(state);
    });
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "formatUyghurPro",
    title: "بىلىك قۇرالى",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "formatUyghurPro") {
    // Send a message to the content script in the active tab
    chrome.tabs.sendMessage(tab.id, { action: "formatText" });
  }
});
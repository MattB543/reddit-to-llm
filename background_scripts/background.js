// Reddit to LLM Extractor - Background Script

// Handle browser action click - run extraction immediately without showing popup
browser.browserAction.onClicked.addListener(async (tab) => {
  // Only proceed if we're on an old Reddit page
  if (tab.url.includes("old.reddit.com")) {
    console.log(
      "Browser action clicked on Old Reddit page - triggering extraction"
    );

    try {
      // Try to get the saved custom prompt from localStorage
      let customPrompt = null;
      try {
        // We need to execute script in the tab context to access its localStorage
        const results = await browser.tabs.executeScript(tab.id, {
          code: "localStorage.getItem('customLLMPrompt');",
        });
        if (results && results[0]) {
          customPrompt = results[0];
          console.log("Using saved custom prompt from localStorage");
        }
      } catch (storageError) {
        console.error("Error accessing saved prompt:", storageError);
      }

      // Send message to content script to extract content
      browser.tabs.sendMessage(tab.id, {
        action: "extract",
        commentCount: 200, // Default to 200 comments
        customPrompt: customPrompt, // Include the saved custom prompt if available
      });
    } catch (error) {
      console.error("Error sending extraction message:", error);
    }
  } else {
    console.log("Not an Old Reddit page - showing a notification");

    // Show a notification if not on Old Reddit
    browser.tabs.sendMessage(tab.id, {
      action: "showNotRedditMessage",
    });
  }
});

// Listen for messages from content script
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "copyToClipboard") {
    console.log("Background script received content to copy to clipboard");

    // Use custom prompt if provided, otherwise use default
    let llmPrompt =
      "Concisely summarize the interesting and high-value content from the below Reddit post and comment thread for me, please. Make the output easy to read and skimmable.\n";

    // Override with custom prompt if available
    if (message.customPrompt) {
      llmPrompt = message.customPrompt + "\n";
      console.log("Using custom LLM prompt");
    } else {
      console.log("Using default LLM prompt");
    }

    const contentWithPrompt = llmPrompt + message.content;

    // Create a temporary textarea element to copy the text
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = contentWithPrompt;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextArea);

    // Send notification to content script
    if (sender.tab) {
      browser.tabs.sendMessage(sender.tab.id, {
        action: "extractionComplete",
        success: true,
      });
    }

    return Promise.resolve({ success: true });
  } else if (message.action === "extract") {
    // Direct extraction request from inline settings
    if (sender.tab) {
      browser.tabs.sendMessage(sender.tab.id, message);
    }
    return Promise.resolve({ success: true });
  }
});

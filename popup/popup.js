// Reddit to LLM Extractor - Popup Script

// DOM elements
const extractButton = document.getElementById("extract-button");
const statusContainer = document.getElementById("status-container");
const statusMessage = document.getElementById("status-message");
const extractionStats = document.getElementById("extraction-stats");
const statTitle = document.getElementById("stat-title");
const statPost = document.getElementById("stat-post");
const statComments = document.getElementById("stat-comments");
const commentSettings = document.getElementById("comment-settings");
const commentCountInput = document.getElementById("comment-count");
const updateCommentsButton = document.getElementById("update-comments-button");
const llmPromptSettings = document.getElementById("llm-prompt-settings");
const llmPromptInput = document.getElementById("llm-prompt");
const resetPromptButton = document.getElementById("reset-prompt-button");

// Default LLM prompt
const DEFAULT_LLM_PROMPT =
  "Concisely summarize the interesting and high-value content from the below Reddit post and comment thread for me, please. Make the output easy to read and skimmable.";

// Helper function to update status
function updateStatus(message, isSuccess = null) {
  statusMessage.textContent = message;

  // Reset classes
  statusContainer.classList.remove("status-success", "status-error");

  if (isSuccess === true) {
    statusContainer.classList.add("status-success");
  } else if (isSuccess === false) {
    statusContainer.classList.add("status-error");
  }
}

// Helper function to update extraction stats
function updateStats(stats) {
  if (!stats) {
    extractionStats.classList.add("hidden");
    return;
  }

  statTitle.textContent = stats.title ? "Found ✓" : "Not found ✗";
  statPost.textContent = stats.originalPost ? "Found ✓" : "Not found ✗";
  statComments.textContent =
    stats.commentsExtracted > 0
      ? `${stats.commentsExtracted} extracted ✓`
      : "None found ✗";

  extractionStats.classList.remove("hidden");

  // Show comment settings and prompt settings after successful extraction
  commentSettings.classList.remove("hidden");
  llmPromptSettings.classList.remove("hidden");
}

// Check if current tab is a Reddit page
async function checkIfRedditPage() {
  try {
    // Load saved custom prompt if any
    loadSavedPrompt();

    // Check if popup is opened in a new tab or as a popup
    const isPopupWindow =
      window.location.protocol.includes("moz-extension") ||
      window.location.protocol.includes("chrome-extension");

    // If opened as a popup window, show settings immediately
    if (isPopupWindow) {
      updateStatus("Settings mode - customize your extraction preferences");
      commentSettings.classList.remove("hidden");
      llmPromptSettings.classList.remove("hidden");
      return;
    }

    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const currentUrl = tabs[0].url;

    if (currentUrl.includes("old.reddit.com")) {
      extractButton.disabled = false;
      updateStatus("Ready to extract Old Reddit content");
    } else {
      extractButton.disabled = true;
      updateStatus("This extension only works on old.reddit.com", false);
    }
  } catch (error) {
    console.error("Error checking current URL:", error);
    updateStatus("Error checking page. Please try again.", false);
  }
}

// Load the saved custom prompt from storage
function loadSavedPrompt() {
  try {
    const savedPrompt = localStorage.getItem("customLLMPrompt");
    if (savedPrompt) {
      llmPromptInput.value = savedPrompt;
    } else {
      // Use the default prompt if no custom prompt is saved
      llmPromptInput.value = DEFAULT_LLM_PROMPT;
    }
  } catch (error) {
    console.error("Error loading saved prompt:", error);
    // Fall back to default prompt on error
    llmPromptInput.value = DEFAULT_LLM_PROMPT;
  }
}

// Save the custom prompt to storage
function saveCustomPrompt() {
  try {
    const customPrompt = llmPromptInput.value.trim();
    if (customPrompt) {
      localStorage.setItem("customLLMPrompt", customPrompt);
    } else {
      localStorage.removeItem("customLLMPrompt");
    }
  } catch (error) {
    console.error("Error saving custom prompt:", error);
  }
}

// Reset prompt to default
function resetPrompt() {
  llmPromptInput.value = DEFAULT_LLM_PROMPT;
  localStorage.removeItem("customLLMPrompt");
  updateStatus("LLM prompt reset to default", true);
  setTimeout(() => {
    updateStatus("Settings mode - customize your extraction preferences");
  }, 1500);
}

// Extract content from the current tab
async function extractContent(customCommentCount = null) {
  try {
    // Update UI to show extraction in progress
    extractButton.disabled = true;
    updateCommentsButton.disabled = true;
    updateStatus("Extracting content...");

    if (!customCommentCount) {
      extractionStats.classList.add("hidden");
      commentSettings.classList.add("hidden");
      llmPromptSettings.classList.add("hidden");
    }

    // Get the active tab
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tabs.length === 0) {
      throw new Error("No active tab found");
    }

    // Save the custom prompt if it's been modified
    saveCustomPrompt();

    // Get the current custom prompt if any
    const customPrompt = llmPromptInput.value.trim();

    // Send message to content script
    const response = await browser.tabs.sendMessage(tabs[0].id, {
      action: "extract",
      commentCount: customCommentCount || 200, // Default to 200 if not specified
      customPrompt: customPrompt || null, // Include custom prompt if provided
    });

    if (response && response.success) {
      updateStatus("Content extracted and copied to clipboard!", true);
      updateStats(response.stats);
    } else {
      updateStatus(
        response.message || "Extraction failed. Please try again.",
        false
      );
    }
  } catch (error) {
    console.error("Error during extraction:", error);
    updateStatus(
      "Error: Content script may not be loaded. Reload the page and try again.",
      false
    );
  } finally {
    extractButton.disabled = false;
    updateCommentsButton.disabled = false;
  }
}

// Extract content with custom comment count
function extractWithCustomCommentCount() {
  // Get value from input, ensure it's at least 1
  const commentCount = Math.max(
    1,
    parseInt(commentCountInput.value, 10) || 200
  );

  // Update input with validated value
  commentCountInput.value = commentCount;

  // Save custom prompt before extraction
  saveCustomPrompt();

  // Extract with custom count
  extractContent(commentCount);
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((message) => {
  if (message.action === "extractionComplete") {
    if (message.success) {
      updateStatus("Content extracted and copied to clipboard!", true);
    }
  }
});

// Add event listeners
extractButton.addEventListener("click", () => extractContent());
updateCommentsButton.addEventListener("click", extractWithCustomCommentCount);
resetPromptButton.addEventListener("click", resetPrompt);

// Initialize popup - with a small delay to ensure DOM is fully rendered in popup mode
document.addEventListener("DOMContentLoaded", () => {
  // Small delay to ensure proper initialization in popup window
  setTimeout(checkIfRedditPage, 50);
});

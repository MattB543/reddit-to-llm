// Reddit to LLM Extractor - Content Script
console.log("Reddit to LLM Extractor: Content script loaded");

/**
 * Extract post content from Reddit
 */
async function extractRedditContent(customCommentCount = 200) {
  // Check if we're on a Reddit post page
  if (
    !window.location.href.includes("/comments/") &&
    !window.location.href.includes("/r/") &&
    !window.location.href.includes("reddit.com")
  ) {
    return {
      success: false,
      message: "This doesn't appear to be a Reddit page.",
    };
  }

  console.log("📊 Analyzing Reddit page DOM structure...");

  // Detect if we're on old or new Reddit
  const isOldReddit = window.location.href.includes("old.reddit.com");
  console.log(`🔍 Detected ${isOldReddit ? "Old" : "New"} Reddit interface`);

  // Wait a moment for any dynamic content to load
  await new Promise((resolve) => setTimeout(resolve, 1000));
  let output = "";

  // Extract post title
  const title =
    document.querySelector("a.title") || document.querySelector("h1");
  if (title) {
    output += `# ${title.textContent.trim()}\n\n`;
    console.log("✅ Extracted title:", title.textContent.trim());
  } else {
    console.warn("⚠️ Couldn't find post title");
  }

  // Extract original post content
  // Old Reddit selectors
  let originalPost = null;

  // Check if we're on old Reddit
  if (isOldReddit) {
    // For old Reddit, the original post is in the first .sitetable's .usertext-body
    const firstSitetable = document.querySelector(".sitetable.linklisting");
    if (firstSitetable) {
      originalPost = firstSitetable.querySelector(".usertext-body .md");
    }
  } else {
    // For new Reddit, try various selectors
    originalPost =
      document.querySelector(
        'div[data-test-id="post-content"] .RichTextJSON-root'
      ) ||
      document.querySelector(".Abstract__mdRoot") ||
      document.querySelector(".Post__content .RichContent");

    // If still not found, try another common pattern
    if (!originalPost) {
      const mainPostContainer =
        document.querySelector('[data-testid="post-container"]') ||
        document.querySelector(".Post");

      if (mainPostContainer) {
        originalPost =
          mainPostContainer.querySelector(".RichText") ||
          mainPostContainer.querySelector('[data-click-id="text"] div') ||
          mainPostContainer.querySelector('[data-click-id="body"] div');
      }
    }
  }

  // Generic fallback patterns
  if (!originalPost) {
    originalPost =
      document.querySelector(".expando .md") ||
      document.querySelector(".thing.self .usertext-body .md") ||
      document.querySelector(".Post__content") ||
      document.querySelector('[data-testid="post"] [role="presentation"]');
  }

  if (originalPost) {
    output += "## Original Post\n\n";
    output += cleanTextContent(originalPost) + "\n\n";
    console.log("✅ Extracted original post content");
  } else {
    console.warn("⚠️ Couldn't find original post content");
  }

  // Extract complete metadata
  output += "## Metadata\n\n";

  // Add the current page URL
  output += `URL: ${window.location.href}\n`;

  // Add extraction timestamp
  const now = new Date();
  output += `Extracted at: ${now.toLocaleString()}\n`;

  // Extract upvotes
  const upvoteElement = document.querySelector(".score.unvoted");
  const upvotes = upvoteElement
    ? upvoteElement.title || upvoteElement.textContent.trim()
    : "Unknown";
  output += `${upvotes} upvotes\n`;

  // Extract post title for metadata section
  if (title) {
    output += `Name: ${title.textContent.trim()}\n`;
  }

  // Extract subreddit
  const subreddit =
    document.querySelector(".subreddit") ||
    document.querySelector('a[href^="/r/"]') ||
    document.querySelector("[data-subreddit-prefixed]"); // Add data attribute selector

  if (subreddit) {
    // Get just the subreddit name, not "about moderation team"
    const subredditText = subreddit.textContent.trim();
    if (subredditText.startsWith("r/")) {
      output += `${subredditText}\n`;
    } else if (subreddit.getAttribute("data-subreddit-prefixed")) {
      // Use the data attribute if available
      output += `${subreddit.getAttribute("data-subreddit-prefixed")}\n`;
    } else if (subreddit.href && subreddit.href.includes("/r/")) {
      // Extract from href if possible
      const match = subreddit.href.match(/\/r\/([^\/]+)/);
      if (match && match[1]) {
        output += `r/${match[1]}\n`;
      }
    }
  }

  // Find post author using data attributes first (more reliable)
  let authorText = "Unknown";
  const postContainer =
    document.querySelector(".thing[data-author]") ||
    document.querySelector("[data-author]");

  if (postContainer && postContainer.getAttribute("data-author")) {
    authorText = postContainer.getAttribute("data-author");
    console.log("✅ Extracted author from data attribute:", authorText);
  } else {
    // Extract author and submission time from traditional elements
    // First try to find the tagline element that contains both author and time information
    const tagline =
      document.querySelector(".tagline") ||
      document.querySelector('[data-test-id="post-content-byline"]') ||
      document.querySelector(".Post__authorByline");

    let author, postTime;

    if (tagline) {
      // Find author within the tagline
      author = tagline.querySelector(".author");
      postTime = tagline.querySelector("time");

      // Handle complete submission text from tagline if possible
      const taglineText = tagline.textContent.trim();
      if (
        taglineText &&
        taglineText.includes("submitted") &&
        !taglineText.includes("moderation team")
      ) {
        output += `${taglineText}\n\n`;
      } else {
        // Build the submission text manually
        authorText = author ? author.textContent.trim() : "Unknown";
        let submissionText = "submitted ";

        if (postTime) {
          submissionText += postTime.textContent.trim() + " by " + authorText;

          // Add the actual date in parentheses if available
          if (postTime.getAttribute("datetime")) {
            const dateObj = new Date(postTime.getAttribute("datetime"));
            const formattedDate = dateObj.toDateString();
            submissionText += ` (${formattedDate})`;
          }
        } else {
          submissionText += "by " + authorText;
        }

        output += submissionText + "\n\n";
      }
    } else {
      // Fallback to the old method if tagline not found
      author = document.querySelector(".author");
      postTime = document.querySelector("time");

      // Build the submission text manually
      authorText = author ? author.textContent.trim() : "Unknown";
      let submissionText = "submitted ";

      if (postTime) {
        submissionText += postTime.textContent.trim() + " by " + authorText;

        // Add the actual date in parentheses if available
        if (postTime.getAttribute("datetime")) {
          const dateObj = new Date(postTime.getAttribute("datetime"));
          const formattedDate = dateObj.toDateString();
          submissionText += ` (${formattedDate})`;
        }
      } else {
        submissionText += "by " + authorText;
      }

      output += submissionText + "\n\n";
    }
  }

  // If we have the author but no submission line output yet, add it
  if (output.indexOf("submitted") === -1) {
    const postTime = document.querySelector("time");
    let submissionText = "submitted ";

    if (postTime) {
      submissionText += postTime.textContent.trim();

      // Add the actual date in parentheses if available
      if (postTime.getAttribute("datetime")) {
        const dateObj = new Date(postTime.getAttribute("datetime"));
        const formattedDate = dateObj.toDateString();
        submissionText += ` (${formattedDate})`;
      }

      submissionText += " by " + authorText;
    } else {
      submissionText += "by " + authorText;
    }

    output += submissionText + "\n\n";
  }

  console.log("✅ Extracted post metadata");

  // Add horizontal rule as separator
  output += "---\n\n";

  // Extract comments
  output += "## Comments\n\n";

  // Different selectors for old vs new Reddit
  let comments = [];
  let maxComments = customCommentCount; // Use custom count instead of hardcoded 200
  console.log(`Setting maximum comment extraction limit to: ${maxComments}`);

  if (isOldReddit) {
    // Old Reddit comment structure
    comments = Array.from(
      document.querySelectorAll(".thing.comment:not(.deleted)")
    );
  } else {
    // New Reddit has multiple possible comment selectors
    comments =
      Array.from(document.querySelectorAll('[data-testid="comment"]')) ||
      Array.from(document.querySelectorAll(".Comment")) ||
      Array.from(document.querySelectorAll('div[id^="t1_"]')) ||
      Array.from(document.querySelectorAll(".CommentTreeNode"));

    // If still no comments found, try alternative selectors
    if (comments.length === 0) {
      comments =
        Array.from(
          document.querySelectorAll(".commentarea .thing.comment:not(.deleted)")
        ) || Array.from(document.querySelectorAll(".Comment__body"));
    }
  }

  console.log(`Found ${comments.length} comments`);

  // Handle lazy-loaded comments by scrolling through the page first
  if (comments.length < 10 && !isOldReddit) {
    console.log("Trying to load more comments by scrolling...");
    // Scroll through the page to trigger lazy loading
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );

    // Scroll in intervals
    const scrollStep = scrollHeight / 10;
    for (let i = 0; i < 10; i++) {
      window.scrollTo(0, i * scrollStep);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Scroll back to top
    window.scrollTo(0, 0);

    // Try to find comments again after scrolling
    comments =
      Array.from(document.querySelectorAll('[data-testid="comment"]')) ||
      Array.from(document.querySelectorAll(".Comment")) ||
      Array.from(document.querySelectorAll('div[id^="t1_"]'));

    console.log(`After scrolling, found ${comments.length} comments`);
  }

  let extractedComments = 0;

  // Add a prefix to clearly indicate threading level
  comments.forEach((comment, index) => {
    if (index >= maxComments) return; // Limit based on custom count

    // Handle different comment structures for old and new Reddit
    let commentAuthor, commentText, commentScore, commentTime;

    if (isOldReddit) {
      // Old Reddit comment selectors
      commentAuthor = comment.querySelector(".author");
      commentText = comment.querySelector(".usertext-body .md");
      commentScore = comment.querySelector(".score.unvoted");
      commentTime = comment.querySelector("time");
    } else {
      // New Reddit comment selectors
      commentAuthor =
        comment.querySelector('[data-testid="comment_author"]') ||
        comment.querySelector(".Comment__author") ||
        comment.querySelector(".CommentAuthor") ||
        comment.querySelector('a[href^="/user/"]');

      commentText =
        comment.querySelector('[data-testid="comment"]') ||
        comment.querySelector(".RichTextJSON-root") ||
        comment.querySelector(".Comment__body") ||
        comment.querySelector(".CommentContent");

      commentScore =
        comment.querySelector('[data-testid="vote-score"]') ||
        comment.querySelector(".Comment__score") ||
        comment.querySelector(".voteCount");

      commentTime =
        comment.querySelector("time") ||
        comment.querySelector('[data-testid="post_timestamp"]') ||
        comment.querySelector(".Comment__timestamp");
    }

    // Fallback for any Reddit interface
    if (!commentAuthor) {
      commentAuthor = comment.querySelector('a[href^="/user/"]');
    }

    if (!commentText) {
      commentText = comment.querySelector("p") || comment;
    }

    // Determine the nesting level
    let nestingLevel = 0;

    if (isOldReddit) {
      // Old Reddit: Count .child containers in the hierarchy
      let currentElement = comment;

      while (currentElement && currentElement !== document.body) {
        if (
          currentElement.classList &&
          currentElement.classList.contains("child")
        ) {
          nestingLevel++;
        }
        currentElement = currentElement.parentElement;
      }
    } else {
      // New Reddit: Check margin or data attributes
      const commentStyle = window.getComputedStyle(comment);
      const marginLeft = parseInt(commentStyle.marginLeft || "0", 10);
      if (marginLeft > 0) {
        nestingLevel = Math.floor(marginLeft / 20); // Assuming ~20px per level
      }

      // Also check for depth attributes
      const depth =
        comment.getAttribute("data-comment-depth") ||
        comment
          .closest("[data-comment-depth]")
          ?.getAttribute("data-comment-depth");
      if (depth) {
        nestingLevel = parseInt(depth, 10);
      }
    }

    // Create a visual threading indicator
    const indent = nestingLevel > 0 ? "  ".repeat(nestingLevel) : "";
    const threadingVisual = nestingLevel > 0 ? "└─ " : "";
    const parentInfo = nestingLevel > 0 ? "[REPLY] " : "";

    if (commentAuthor && commentText) {
      // Format comment
      output += `${indent}${threadingVisual}${parentInfo}**${commentAuthor.textContent.trim()}**`;

      // Score without "points"
      if (commentScore) {
        let scoreText = commentScore.textContent.trim();
        scoreText = scoreText.replace(" points", "");
        output += ` [Score: ${scoreText}]`;
      }

      // Timestamp
      if (commentTime) {
        let timeText =
          commentTime.getAttribute("datetime") ||
          commentTime.textContent.trim();
        timeText = timeText.replace("+00:00", "");
        output += ` (${timeText})`;
      }

      output += `:\n`;

      // Comment content with indentation
      output += `${indent}  ${cleanTextContent(commentText).replace(
        /\n/g,
        `\n${indent}  `
      )}\n\n`;
      extractedComments++;
    }
  });

  console.log(`✅ Extracted ${extractedComments} comments`);

  return {
    success: true,
    content: output,
    stats: {
      title: title ? true : false,
      originalPost: originalPost ? true : false,
      commentsExtracted: extractedComments,
    },
  };
}

/**
 * Clean text content for better formatting
 */
function cleanTextContent(element) {
  // Clone the element to avoid modifying the original
  const clone = element.cloneNode(true);

  // Handle links
  const links = clone.querySelectorAll("a");
  links.forEach((link) => {
    // Replace links with markdown format
    if (link.textContent && link.href) {
      const replacement = document.createTextNode(
        `[${link.textContent}](${link.href})`
      );
      link.parentNode.replaceChild(replacement, link);
    }
  });

  // Handle bullet points
  const lists = clone.querySelectorAll("ul, ol");
  lists.forEach((list) => {
    const listItems = list.querySelectorAll("li");
    listItems.forEach((item, i) => {
      const prefix = list.tagName === "OL" ? `${i + 1}. ` : "- ";
      item.textContent = prefix + item.textContent;
    });
  });

  // Handle blockquotes
  const quotes = clone.querySelectorAll("blockquote");
  quotes.forEach((quote) => {
    // Add '>' to the beginning of each line
    quote.textContent = quote.textContent
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  });

  // Get the text content and clean it up
  let text = clone.textContent;

  // Remove excessive whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/\s{2,}/g, " ");

  return text.trim();
}

/**
 * Show inline settings panel instead of opening a popup window
 */
function showSettingsPanel() {
  // Remove any existing settings panel
  const existingPanel = document.getElementById(
    "reddit-extractor-settings-panel"
  );
  if (existingPanel) {
    document.body.removeChild(existingPanel);
    return; // If panel exists, just remove it (toggle behavior)
  }

  // Create settings panel container
  const panel = document.createElement("div");
  panel.id = "reddit-extractor-settings-panel";
  panel.style.position = "fixed";
  panel.style.top = "70px"; // Position below the notification
  panel.style.right = "20px";
  panel.style.zIndex = "10000";
  panel.style.padding = "20px";
  panel.style.background = "#ffffff";
  panel.style.color = "#333333";
  panel.style.borderRadius = "4px";
  panel.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  panel.style.transition = "opacity 0.3s ease-in-out";
  panel.style.opacity = "0";
  panel.style.width = "300px";
  panel.style.maxHeight = "500px";
  panel.style.overflowY = "auto";

  // Create header
  const header = document.createElement("h2");
  header.textContent = "Reddit to LLM Extractor Settings";
  header.style.fontSize = "16px";
  header.style.marginTop = "0";
  header.style.marginBottom = "15px";
  header.style.textAlign = "center";
  panel.appendChild(header);

  // Create close button
  const closeButton = document.createElement("button");
  closeButton.innerHTML = "×";
  closeButton.style.position = "absolute";
  closeButton.style.top = "10px";
  closeButton.style.right = "10px";
  closeButton.style.background = "none";
  closeButton.style.border = "none";
  closeButton.style.fontSize = "20px";
  closeButton.style.cursor = "pointer";
  closeButton.style.color = "#777";
  closeButton.addEventListener("click", () => {
    panel.style.opacity = "0";
    setTimeout(() => {
      if (panel.parentNode) {
        document.body.removeChild(panel);
      }
    }, 300);
  });
  panel.appendChild(closeButton);

  // Comment settings
  const settingsSection = document.createElement("div");
  settingsSection.style.marginBottom = "15px";

  const settingsHeader = document.createElement("h3");
  settingsHeader.textContent = "Comment Settings";
  settingsHeader.style.fontSize = "14px";
  settingsHeader.style.marginBottom = "10px";
  settingsSection.appendChild(settingsHeader);

  // Comment count input group
  const inputGroup = document.createElement("div");
  inputGroup.style.marginBottom = "15px";

  const label = document.createElement("label");
  label.textContent = "Number of comments to extract:";
  label.style.display = "block";
  label.style.marginBottom = "5px";
  label.style.fontSize = "12px";
  inputGroup.appendChild(label);

  const commentCountInput = document.createElement("input");
  commentCountInput.type = "number";
  commentCountInput.id = "reddit-extractor-comment-count";
  commentCountInput.min = "1";
  commentCountInput.value = "200";
  commentCountInput.style.width = "100%";
  commentCountInput.style.padding = "8px";
  commentCountInput.style.border = "1px solid #e6e6e6";
  commentCountInput.style.borderRadius = "4px";
  commentCountInput.style.fontSize = "14px";
  inputGroup.appendChild(commentCountInput);

  settingsSection.appendChild(inputGroup);

  // LLM Prompt settings
  const promptSection = document.createElement("div");
  promptSection.style.marginTop = "20px";
  promptSection.style.marginBottom = "15px";

  const promptHeader = document.createElement("h3");
  promptHeader.textContent = "LLM Prompt Settings";
  promptHeader.style.fontSize = "14px";
  promptHeader.style.marginBottom = "10px";
  promptSection.appendChild(promptHeader);

  // Prompt input group
  const promptInputGroup = document.createElement("div");
  promptInputGroup.style.marginBottom = "15px";

  const promptLabel = document.createElement("label");
  promptLabel.textContent = "Custom prompt to prepend to content:";
  promptLabel.style.display = "block";
  promptLabel.style.marginBottom = "5px";
  promptLabel.style.fontSize = "12px";
  promptInputGroup.appendChild(promptLabel);

  const promptInput = document.createElement("textarea");
  promptInput.id = "reddit-extractor-llm-prompt";
  promptInput.rows = "4";
  promptInput.placeholder =
    "Enter your custom LLM prompt here. Leave blank to use the default.";
  promptInput.style.width = "100%";
  promptInput.style.padding = "8px";
  promptInput.style.border = "1px solid #e6e6e6";
  promptInput.style.borderRadius = "4px";
  promptInput.style.fontSize = "14px";
  promptInput.style.resize = "vertical";
  promptInput.style.fontFamily = "inherit";

  // Try to load saved prompt from localStorage
  try {
    const savedPrompt = localStorage.getItem("customLLMPrompt");
    if (savedPrompt) {
      promptInput.value = savedPrompt;
    } else {
      // Set the default prompt if no custom prompt is saved
      promptInput.value =
        "Concisely summarize the interesting and high-value content from the below Reddit post and comment thread for me, please. Make the output easy to read and skimmable.";
    }
  } catch (e) {
    console.error("Error loading saved prompt:", e);
    // Fall back to default prompt on error
    promptInput.value =
      "Concisely summarize the interesting and high-value content from the below Reddit post and comment thread for me, please. Make the output easy to read and skimmable.";
  }

  promptInputGroup.appendChild(promptInput);

  // Add default prompt hint
  const promptHint = document.createElement("div");
  promptHint.style.fontSize = "10px";
  promptHint.style.color = "#777";
  promptHint.style.marginTop = "5px";
  promptHint.style.fontStyle = "italic";
  promptHint.textContent =
    "You can modify the prompt above or reset it to default";
  promptInputGroup.appendChild(promptHint);

  // Reset button
  const resetButton = document.createElement("button");
  resetButton.textContent = "Reset to Default";
  resetButton.style.background = "none";
  resetButton.style.border = "none";
  resetButton.style.color = "#0079d3";
  resetButton.style.fontSize = "12px";
  resetButton.style.cursor = "pointer";
  resetButton.style.padding = "5px";
  resetButton.style.textDecoration = "underline";
  resetButton.style.marginTop = "5px";
  resetButton.addEventListener("click", () => {
    promptInput.value =
      "Concisely summarize the interesting and high-value content from the below Reddit post and comment thread for me, please. Make the output easy to read and skimmable.";
    localStorage.removeItem("customLLMPrompt");
  });
  promptInputGroup.appendChild(resetButton);

  promptSection.appendChild(promptInputGroup);
  settingsSection.appendChild(promptSection);

  // Extract button
  const extractButton = document.createElement("button");
  extractButton.textContent = "Extract With These Settings";
  extractButton.style.display = "block";
  extractButton.style.width = "100%";
  extractButton.style.padding = "10px";
  extractButton.style.backgroundColor = "#0079d3"; // Reddit blue
  extractButton.style.color = "white";
  extractButton.style.border = "none";
  extractButton.style.borderRadius = "4px";
  extractButton.style.fontSize = "14px";
  extractButton.style.fontWeight = "bold";
  extractButton.style.cursor = "pointer";
  extractButton.style.transition = "background-color 0.2s";
  extractButton.addEventListener("mouseover", () => {
    extractButton.style.backgroundColor = "#016fc1";
  });
  extractButton.addEventListener("mouseout", () => {
    extractButton.style.backgroundColor = "#0079d3";
  });
  extractButton.addEventListener("click", () => {
    // Get custom comment count
    const commentCount = Math.max(
      1,
      parseInt(commentCountInput.value, 10) || 200
    );

    // Get custom prompt if provided
    const customPrompt = promptInput.value.trim();

    // Save custom prompt to localStorage for future use
    if (customPrompt) {
      try {
        localStorage.setItem("customLLMPrompt", customPrompt);
      } catch (e) {
        console.error("Error saving custom prompt:", e);
      }
    } else {
      localStorage.removeItem("customLLMPrompt");
    }

    // Close the settings panel
    panel.style.opacity = "0";
    setTimeout(() => {
      if (panel.parentNode) {
        document.body.removeChild(panel);
      }
    }, 300);

    // Trigger extraction with custom comment count and prompt
    browser.runtime.sendMessage({
      action: "extract",
      commentCount: commentCount,
      customPrompt: customPrompt || null,
    });
  });

  settingsSection.appendChild(extractButton);
  panel.appendChild(settingsSection);

  // Footer
  const footer = document.createElement("div");
  footer.style.marginTop = "15px";
  footer.style.textAlign = "center";
  footer.style.fontSize = "12px";
  footer.style.color = "#777";

  const footerText = document.createElement("p");
  footerText.textContent = "Content will be automatically copied to clipboard";
  footer.appendChild(footerText);

  panel.appendChild(footer);
  document.body.appendChild(panel);

  // Fade in
  setTimeout(() => {
    panel.style.opacity = "1";
  }, 10);
}

/**
 * Show feedback popup in the page
 */
function showFeedback(message, isSuccess = true, showSettings = true) {
  // Create the main popup container
  const popup = document.createElement("div");
  popup.style.position = "fixed";
  popup.style.top = "20px";
  popup.style.right = "20px";
  popup.style.zIndex = "10000";
  popup.style.padding = "15px 20px";
  popup.style.background = isSuccess ? "#4CAF50" : "#F44336";
  popup.style.color = "white";
  popup.style.borderRadius = "4px";
  popup.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  popup.style.transition = "opacity 0.3s ease-in-out";
  popup.style.opacity = "0";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "space-between";
  popup.style.minWidth = "300px";

  // Create message text element
  const messageText = document.createElement("div");
  messageText.textContent = message;
  messageText.style.marginRight = "15px";
  popup.appendChild(messageText);

  // Add gear icon button if settings should be shown
  if (showSettings) {
    const settingsButton = document.createElement("button");
    settingsButton.innerHTML = "⚙️"; // Gear emoji
    settingsButton.style.background = "none";
    settingsButton.style.border = "none";
    settingsButton.style.color = "white";
    settingsButton.style.fontSize = "20px";
    settingsButton.style.cursor = "pointer";
    settingsButton.style.padding = "0";
    settingsButton.style.marginLeft = "10px";
    settingsButton.title = "Open settings";

    // Add hover effect
    settingsButton.style.transition = "transform 0.2s";
    settingsButton.onmouseover = () => {
      settingsButton.style.transform = "rotate(30deg)";
    };
    settingsButton.onmouseout = () => {
      settingsButton.style.transform = "rotate(0)";
    };

    // Add click handler to show inline settings panel instead of opening a popup
    settingsButton.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent event from bubbling up
      showSettingsPanel();
    });

    popup.appendChild(settingsButton);
  }

  document.body.appendChild(popup);

  // Fade in
  setTimeout(() => {
    popup.style.opacity = "1";
  }, 10);

  // Fade out and remove
  setTimeout(() => {
    popup.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(popup);
    }, 300);
  }, 5000); // Increased time to 5 seconds to give user time to see and click the gear
}

/**
 * Show loading popup with spinner
 */
function showLoadingFeedback(message = "Extracting Reddit content...") {
  // Create the main popup container
  const popup = document.createElement("div");
  popup.id = "reddit-extractor-loading";
  popup.style.position = "fixed";
  popup.style.top = "20px";
  popup.style.right = "20px";
  popup.style.zIndex = "10000";
  popup.style.padding = "15px 20px";
  popup.style.background = "#2196F3"; // Blue for loading
  popup.style.color = "white";
  popup.style.borderRadius = "4px";
  popup.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
  popup.style.transition = "opacity 0.3s ease-in-out";
  popup.style.opacity = "0";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "space-between";
  popup.style.minWidth = "300px";

  // Create spinner element
  const spinner = document.createElement("div");
  spinner.style.width = "20px";
  spinner.style.height = "20px";
  spinner.style.border = "3px solid rgba(255,255,255,0.3)";
  spinner.style.borderRadius = "50%";
  spinner.style.borderTopColor = "white";
  spinner.style.animation = "reddit-extractor-spin 1s linear infinite";
  spinner.style.marginRight = "10px";

  // Add keyframes for spinner animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes reddit-extractor-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Create message text element
  const messageText = document.createElement("div");
  messageText.textContent = message;
  messageText.style.marginRight = "15px";

  // Add elements to popup
  popup.appendChild(spinner);
  popup.appendChild(messageText);

  // Remove any existing loading popups
  const existingPopup = document.getElementById("reddit-extractor-loading");
  if (existingPopup) {
    document.body.removeChild(existingPopup);
  }

  document.body.appendChild(popup);

  // Fade in
  setTimeout(() => {
    popup.style.opacity = "1";
  }, 10);

  // Return a function to remove the loading popup
  return function removeLoading() {
    const loadingPopup = document.getElementById("reddit-extractor-loading");
    if (loadingPopup) {
      loadingPopup.style.opacity = "0";
      setTimeout(() => {
        if (loadingPopup.parentNode) {
          document.body.removeChild(loadingPopup);
        }
      }, 300);
    }
  };
}

// Listen for messages from the popup or background script
browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === "extract") {
    console.log("Received extract command from popup or browser action");

    // Show loading feedback immediately
    const removeLoading = showLoadingFeedback();

    // Get custom comment count if provided, default to 200
    const commentCount = message.commentCount || 200;
    console.log(`Using comment limit: ${commentCount}`);

    // Store custom prompt if provided in the message, otherwise check localStorage
    let customPrompt = message.customPrompt || null;

    // If no prompt provided in message, try to get it from localStorage
    if (!customPrompt) {
      try {
        const savedPrompt = localStorage.getItem("customLLMPrompt");
        if (savedPrompt) {
          customPrompt = savedPrompt;
          console.log("Using custom LLM prompt from localStorage");
        }
      } catch (e) {
        console.error("Error loading saved prompt from localStorage:", e);
      }
    }

    if (customPrompt) {
      console.log("Using custom LLM prompt");
    }

    try {
      const result = await extractRedditContent(commentCount);

      // Remove loading indicator
      removeLoading();

      if (result.success) {
        // Send the content back to the background script to handle clipboard operations
        browser.runtime.sendMessage({
          action: "copyToClipboard",
          content: result.content,
          customPrompt: customPrompt, // Pass along the custom prompt if it exists
        });

        showFeedback(
          `Reddit content extracted with ${result.stats.commentsExtracted} comments and copied to clipboard!`,
          true,
          true // Show settings button
        );
        return { success: true, stats: result.stats };
      } else {
        showFeedback(result.message, false, true);
        return { success: false, message: result.message };
      }
    } catch (error) {
      // Remove loading indicator on error too
      removeLoading();

      console.error("Extraction error:", error);
      showFeedback(
        "Error extracting content. See console for details.",
        false,
        true
      );
      return { success: false, message: error.toString() };
    }
  } else if (message.action === "showNotRedditMessage") {
    // Show a message when not on Old Reddit
    showFeedback("This extension only works on old.reddit.com", false, true);
    return Promise.resolve({ success: false });
  } else if (message.action === "extractionComplete") {
    // Handle extraction complete message from background script
    // We already showed a feedback message with comment count stats,
    // so we don't need to show another message here
    return Promise.resolve({ success: true });
  }
});

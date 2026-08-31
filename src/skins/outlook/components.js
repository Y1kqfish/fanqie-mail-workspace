(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  function makeNode(documentLike, tagName, className = "", text = "") {
    const node = documentLike.createElement(tagName);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function addIcon(documentLike, parent, name, {size = 20, variant = "regular"} = {}) {
    const icon = globalThis.Fqmail.fluentIcons.create(documentLike, name, {size, variant});
    parent.append(icon);
    return icon;
  }

  function createIconButton(documentLike, {
    label,
    icon,
    className = "",
    onClick = () => {},
    disabled = false,
    iconSize = 20,
  }) {
    const button = makeNode(documentLike, "button", `fqmail-icon-button ${className}`.trim());
    button.type = "button";
    button.disabled = Boolean(disabled);
    button.setAttribute?.("type", "button");
    button.setAttribute?.("aria-label", label);
    button.setAttribute?.("title", label);
    addIcon(documentLike, button, icon, {size: iconSize});
    button.addEventListener?.("click", (event) => {
      if (!button.disabled) onClick(event);
    });
    return button;
  }

  function createSplitCommand(documentLike, options) {
    const root = makeNode(documentLike, "div", options.className || "fqmail-split-command");
    const mainButton = createIconButton(documentLike, {
      label: options.label,
      icon: options.icon,
      className: "fqmail-command-main",
      onClick: options.onMain,
      disabled: options.disabled,
    });
    const label = makeNode(documentLike, "span", "fqmail-command-label", options.label);
    mainButton.append(label);
    const dropdownButton = createIconButton(documentLike, {
      label: `${options.label}选项`,
      icon: "chevronDown",
      iconSize: 12,
      className: "fqmail-command-dropdown",
      onClick: options.onDropdown,
    });
    root.append(mainButton, dropdownButton);
    return {root, mainButton, dropdownButton};
  }

  function createFolderRow(documentLike, {label, icon, selected = false, onClick = () => {}}) {
    const root = createIconButton(documentLike, {
      label,
      icon,
      className: "fqmail-folder-row",
      onClick,
    });
    const labelNode = makeNode(documentLike, "span", "fqmail-folder-label", label);
    root.append(labelNode);
    if (selected) {
      root.setAttribute?.("aria-current", "page");
      root.setAttribute?.("aria-selected", "true");
    }
    return {root, labelNode};
  }

  function createMessageRow(documentLike, {chapterId, sender, subject, preview, avatarText = "", avatarColor = "", selected = false}) {
    const root = makeNode(documentLike, "article", "fqmail-message-row");
    root.setAttribute?.("role", "option");
    root.setAttribute?.("data-chapter-id", chapterId || "");
    root.setAttribute?.("aria-selected", String(Boolean(selected)));
    if (selected) root.className += " fqmail-message-row--selected";
    const checkbox = makeNode(documentLike, "input", "fqmail-message-checkbox");
    checkbox.type = "checkbox";
    checkbox.setAttribute?.("type", "checkbox");
    checkbox.setAttribute?.("aria-label", "选择当前章节");
    checkbox.checked = Boolean(selected);
    const avatar = makeNode(documentLike, "span", "fqmail-message-avatar", avatarText);
    if (avatarColor) {
      avatar.setAttribute?.("data-fqmail-avatar-color", avatarColor);
      if (avatar.style) avatar.style.backgroundColor = avatarColor;
    }
    const content = makeNode(documentLike, "div", "fqmail-message-content");
    const senderNode = makeNode(documentLike, "span", "fqmail-message-sender", sender || "");
    const subjectNode = makeNode(documentLike, "span", "fqmail-message-subject", subject || "");
    const previewNode = makeNode(documentLike, "span", "fqmail-message-preview", preview || "");
    const timeNode = makeNode(documentLike, "time", "fqmail-message-time", "现在");
    content.append(senderNode, subjectNode, previewNode);
    root.append(checkbox, avatar, content, timeNode);
    return {root, checkbox, avatar, senderNode, subjectNode, previewNode, timeNode};
  }

  function createMenu(documentLike, {label, items}) {
    const root = makeNode(documentLike, "div", "fqmail-more-menu");
    root.setAttribute?.("role", "menu");
    root.setAttribute?.("aria-label", label);
    root.hidden = true;
    const itemButtons = [];
    for (const item of items) {
      const button = createIconButton(documentLike, {
        label: item.label,
        icon: item.icon,
        className: "fqmail-menu-item",
        onClick: item.onClick,
      });
      button.setAttribute?.("role", "menuitem");
      button.setAttribute?.("data-menu-id", item.id);
      const text = makeNode(documentLike, "span", "fqmail-menu-label", item.label);
      button.append(text);
      root.append(button);
      itemButtons.push(button);
    }
    return {root, itemButtons};
  }

  globalThis.Fqmail.outlookComponents = {
    makeNode,
    addIcon,
    createIconButton,
    createSplitCommand,
    createFolderRow,
    createMessageRow,
    createMenu,
  };
})();

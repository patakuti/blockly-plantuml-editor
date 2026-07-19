export interface TabDefinition {
  key: string;
  label: string;
}

export function createTabs(
  container: HTMLElement,
  tabs: TabDefinition[],
  onSelect: (key: string) => void,
): void {
  const tabBar = document.createElement("div");
  tabBar.className = "tab-bar";

  const buttons = new Map<string, HTMLButtonElement>();

  function select(key: string): void {
    for (const [tabKey, button] of buttons) {
      button.classList.toggle("active", tabKey === key);
    }
    onSelect(key);
  }

  for (const tab of tabs) {
    const button = document.createElement("button");
    button.textContent = tab.label;
    button.className = "tab-button";
    button.addEventListener("click", () => select(tab.key));
    buttons.set(tab.key, button);
    tabBar.appendChild(button);
  }

  container.appendChild(tabBar);

  if (tabs.length > 0) select(tabs[0].key);
}

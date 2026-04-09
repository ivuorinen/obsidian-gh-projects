import { vi } from "vitest";

export const Plugin = class {};
export const PluginSettingTab = class {};
export const Setting = class {
	setName() { return this; }
	setDesc() { return this; }
	addText() { return this; }
	addToggle() { return this; }
	addDropdown() { return this; }
	addSearch() { return this; }
	addComponent() { return this; }
	setHeading() { return this; }
};
export const Notice = class {
	constructor(public message: string) {}
};
export const normalizePath = (path: string) => path.replace(/\\/g, "/").replace(/\/+/g, "/");
export const requestUrl = vi.fn();
export const AbstractInputSuggest = class {
	constructor(public app: unknown, public inputEl: HTMLElement) {}
};
export const SuggestModal = class {
	constructor(public app: unknown) {}
};
export const TFile = class {};
export const TFolder = class {};
export const SecretComponent = class {};

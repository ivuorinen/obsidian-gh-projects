import { vi } from "vitest";

vi.mock("obsidian", () => ({
	Plugin: class {},
	PluginSettingTab: class {},
	Setting: class {
		setName() { return this; }
		setDesc() { return this; }
		addText() { return this; }
		addToggle() { return this; }
		addDropdown() { return this; }
		addSearch() { return this; }
		addComponent() { return this; }
		setHeading() { return this; }
	},
	Notice: class {
		constructor(public message: string) {}
	},
	normalizePath: (path: string) => path.replace(/\\/g, "/").replace(/\/+/g, "/"),
	requestUrl: vi.fn(),
	AbstractInputSuggest: class {
		constructor(public app: unknown, public inputEl: HTMLElement) {}
	},
	SuggestModal: class {
		constructor(public app: unknown) {}
	},
	TFile: class {},
	TFolder: class {},
	SecretComponent: class {},
}));

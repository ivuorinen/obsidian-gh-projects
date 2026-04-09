import { vi } from "vitest";

export const Plugin = class {
	app: unknown;
	addSettingTab = vi.fn();
	addCommand = vi.fn();
	addRibbonIcon = vi.fn();
	addStatusBarItem = vi.fn(() => ({
		setText: vi.fn(),
	}));
	registerInterval = vi.fn();
	loadData = vi.fn(async () => ({}));
	saveData = vi.fn(async () => {});
};
export const PluginSettingTab = class {
	constructor(public app: unknown, public plugin: unknown) {}
	containerEl = { empty: vi.fn() } as unknown as HTMLElement;
};
export const Setting = class {
	constructor(public containerEl: unknown) {}
	setName() { return this; }
	setDesc() { return this; }
	addText(cb?: (t: unknown) => void) {
		if (cb) cb({
			setPlaceholder() { return this; },
			setValue() { return this; },
			onChange() { return this; },
		});
		return this;
	}
	addToggle(cb?: (t: unknown) => void) {
		if (cb) cb({
			setValue() { return this; },
			onChange() { return this; },
		});
		return this;
	}
	addDropdown(cb?: (t: unknown) => void) {
		if (cb) cb({
			addOption() { return this; },
			setValue() { return this; },
			onChange() { return this; },
		});
		return this;
	}
	addSearch(cb?: (t: unknown) => void) {
		if (cb) cb({
			setPlaceholder() { return this; },
			setValue() { return this; },
			onChange() { return this; },
			inputEl: document.createElement("input"),
		});
		return this;
	}
	addComponent(cb?: (el: unknown) => unknown) {
		if (cb) cb(document.createElement("div"));
		return this;
	}
	setHeading() { return this; }
};
export const Notice = class {
	constructor(public message: string) {}
};
export const normalizePath = (path: string) => path.replace(/\\/g, "/").replace(/\/+/g, "/");
export const requestUrl = vi.fn();
export const AbstractInputSuggest = class {
	constructor(public app: unknown, public inputEl: HTMLElement) {}
	setValue(_v: string) { return this; }
	close() {}
};
export const SuggestModal = class {
	constructor(public app: unknown) {}
	open() {}
	close() {}
	getSuggestions(_query: string): unknown[] { return []; }
	renderSuggestion(_item: unknown, _el: HTMLElement) {}
	onChooseSuggestion(_item: unknown) {}
};
export const TFile = class {
	path = "";
	basename = "";
};
export const TFolder = class {
	path = "";
};
export const SecretComponent = class {
	constructor(public app: unknown, public el: unknown) {}
	setValue(_v: string) { return this; }
	onChange(_cb: (v: string) => void) { return this; }
};

export const App = class {
	vault = {
		getMarkdownFiles: vi.fn(() => [] as unknown[]),
		getAllFolders: vi.fn(() => [] as unknown[]),
		getFileByPath: vi.fn(() => null),
		getFolderByPath: vi.fn(() => null),
		read: vi.fn(async () => ""),
		modify: vi.fn(async () => {}),
		create: vi.fn(async () => {}),
		createFolder: vi.fn(async () => {}),
		createBinary: vi.fn(async () => {}),
	};
	workspace = {
		onLayoutReady: vi.fn((cb: () => void) => cb()),
		openLinkText: vi.fn(),
	};
	secretStorage = {
		getSecret: vi.fn((_name: string) => null as string | null),
		setSecret: vi.fn(),
		listSecrets: vi.fn(() => [] as string[]),
	};
	plugins = {
		getPlugin: vi.fn((_id: string) => null),
	};
};

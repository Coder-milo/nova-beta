import { r as __toESM } from "./rolldown-runtime-B-1-B7_t.js";
import { t as require_react } from "./react.js";
import { c as useRefWithInit } from "./useRenderElement-8xuqwLft.js";
//#region node_modules/.pnpm/@base-ui+utils@0.3.1_@types_7e6bdad8e7da1ec16ace3d23698649a9/node_modules/@base-ui/utils/useOnMount.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var EMPTY$1 = [];
/**
* A React.useEffect equivalent that runs once, when the component is mounted.
*/
function useOnMount(fn) {
	import_react.useEffect(fn, EMPTY$1);
}
//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.1_@types_7e6bdad8e7da1ec16ace3d23698649a9/node_modules/@base-ui/utils/useTimeout.mjs
var EMPTY = 0;
var Timeout = class Timeout {
	static create() {
		return new Timeout();
	}
	currentId = EMPTY;
	/**
	* Executes `fn` after `delay`, clearing any previously scheduled call.
	*/
	start(delay, fn) {
		this.clear();
		this.currentId = setTimeout(() => {
			this.currentId = EMPTY;
			fn();
		}, delay);
	}
	isStarted() {
		return this.currentId !== EMPTY;
	}
	clear = () => {
		if (this.currentId !== EMPTY) {
			clearTimeout(this.currentId);
			this.currentId = EMPTY;
		}
	};
	disposeEffect = () => {
		return this.clear;
	};
};
/**
* A `setTimeout` with automatic cleanup and guard.
*/
function useTimeout() {
	const timeout = useRefWithInit(Timeout.create).current;
	useOnMount(timeout.disposeEffect);
	return timeout;
}
//#endregion
export { useTimeout as n, useOnMount as r, Timeout as t };

import { r as EMPTY_OBJECT } from "./useRenderElement-8xuqwLft.js";
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/internals/reason-parts.mjs
var none = "none";
var triggerPress = "trigger-press";
var triggerHover = "trigger-hover";
var triggerFocus = "trigger-focus";
var outsidePress = "outside-press";
var itemPress = "item-press";
var closePress = "close-press";
var focusOut = "focus-out";
var escapeKey = "escape-key";
var listNavigation = "list-navigation";
var cancelOpen = "cancel-open";
var siblingOpen = "sibling-open";
var disabled = "disabled";
var imperativeAction = "imperative-action";
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/internals/createBaseUIEventDetails.mjs
/**
* Maps a change `reason` string to the corresponding native event type.
*/
/**
* Details of custom change events emitted by Base UI components.
*/
/**
* Details of custom generic events emitted by Base UI components.
*/
/**
* Creates a Base UI event details object with the given reason and utilities
* for preventing Base UI's internal event handling.
*/
function createChangeEventDetails(reason, event, trigger, customProperties) {
	let canceled = false;
	let allowPropagation = false;
	const custom = customProperties ?? EMPTY_OBJECT;
	return {
		reason,
		event: event ?? new Event("base-ui"),
		cancel() {
			canceled = true;
		},
		allowPropagation() {
			allowPropagation = true;
		},
		get isCanceled() {
			return canceled;
		},
		get isPropagationAllowed() {
			return allowPropagation;
		},
		trigger,
		...custom
	};
}
//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.1_@types_7e6bdad8e7da1ec16ace3d23698649a9/node_modules/@base-ui/utils/owner.mjs
function ownerDocument(node) {
	return node?.ownerDocument || document;
}
//#endregion
export { disabled as a, imperativeAction as c, none as d, outsidePress as f, triggerPress as g, triggerHover as h, closePress as i, itemPress as l, triggerFocus as m, createChangeEventDetails as n, escapeKey as o, siblingOpen as p, cancelOpen as r, focusOut as s, ownerDocument as t, listNavigation as u };

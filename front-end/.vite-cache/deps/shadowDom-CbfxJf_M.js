import { r as __toESM } from "./rolldown-runtime-B-1-B7_t.js";
import { t as require_react } from "./react.js";
import { r as SafeReact } from "./useIsoLayoutEffect-C-L5SFc_.js";
import { g as isShadowRoot } from "./floating-ui.utils.dom-C3AI9ZqY.js";
//#region node_modules/.pnpm/@base-ui+utils@0.3.1_@types_7e6bdad8e7da1ec16ace3d23698649a9/node_modules/@base-ui/utils/useId.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var globalId = 0;
function useGlobalId(idOverride, prefix = "mui") {
	const [defaultId, setDefaultId] = import_react.useState(idOverride);
	const id = idOverride || defaultId;
	import_react.useEffect(() => {
		if (defaultId == null) {
			globalId += 1;
			setDefaultId(`${prefix}-${globalId}`);
		}
	}, [defaultId, prefix]);
	return id;
}
var maybeReactUseId = SafeReact.useId;
/**
*
* @example <div id={useId()} />
* @param idOverride
* @returns {string}
*/
function useId(idOverride, prefix) {
	if (maybeReactUseId !== void 0) {
		const reactId = maybeReactUseId();
		return idOverride ?? (prefix ? `${prefix}-${reactId}` : reactId);
	}
	return useGlobalId(idOverride, prefix);
}
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/internals/useBaseUiId.mjs
/**
* Wraps `useId` and prefixes generated `id`s with `base-ui-`
* @param {string | undefined} idOverride overrides the generated id when provided
* @returns {string | undefined}
*/
function useBaseUiId(idOverride) {
	return useId(idOverride, "base-ui");
}
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/internals/shadowDom.mjs
function activeElement(doc) {
	let element = doc.activeElement;
	while (element?.shadowRoot?.activeElement != null) element = element.shadowRoot.activeElement;
	return element;
}
function contains(parent, child) {
	if (!parent || !child) return false;
	const rootNode = child.getRootNode?.();
	if (parent.contains(child)) return true;
	if (rootNode && isShadowRoot(rootNode)) {
		let next = child;
		while (next) {
			if (parent === next) return true;
			next = next.parentNode || next.host;
		}
	}
	return false;
}
function getTarget(event) {
	if ("composedPath" in event) return event.composedPath()[0];
	return event.target;
}
//#endregion
export { useId as a, useBaseUiId as i, contains as n, getTarget as r, activeElement as t };

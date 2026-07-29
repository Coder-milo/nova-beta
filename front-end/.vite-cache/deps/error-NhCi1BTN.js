//#region node_modules/.pnpm/@base-ui+utils@0.3.1_@types_7e6bdad8e7da1ec16ace3d23698649a9/node_modules/@base-ui/utils/error.mjs
var set = /* @__PURE__ */ new Set();
function error(...messages) {
	{
		const messageKey = messages.join(" ");
		if (!set.has(messageKey)) {
			set.add(messageKey);
			console.error(`Base UI: ${messageKey}`);
		}
	}
}
//#endregion
export { error as t };

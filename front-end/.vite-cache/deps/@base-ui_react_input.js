import { r as __toESM } from "./rolldown-runtime-B-1-B7_t.js";
import { t as require_react } from "./react.js";
import { t as require_jsx_runtime } from "./react_jsx-runtime.js";
import { c as useRefWithInit, i as NOOP, r as EMPTY_OBJECT, t as useRenderElement } from "./useRenderElement-8xuqwLft.js";
import { n as useStableCallback, t as useIsoLayoutEffect } from "./useIsoLayoutEffect-C-L5SFc_.js";
import { d as isElement } from "./floating-ui.utils.dom-C3AI9ZqY.js";
import { d as none, n as createChangeEventDetails, t as ownerDocument } from "./owner--8oVGIaF.js";
import { i as useBaseUiId, t as activeElement } from "./shadowDom-CbfxJf_M.js";
import { t as useControlled } from "./useControlled-BShs77hv.js";
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/field/control/FieldControlDataAttributes.mjs
var FieldControlDataAttributes = /*#__PURE__*/ function(FieldControlDataAttributes) {
	/**
	* Present when the field is disabled.
	*/
	FieldControlDataAttributes["disabled"] = "data-disabled";
	/**
	* Present when the field is in a valid state.
	*/
	FieldControlDataAttributes["valid"] = "data-valid";
	/**
	* Present when the field is in an invalid state.
	*/
	FieldControlDataAttributes["invalid"] = "data-invalid";
	/**
	* Present when the field has been touched.
	*/
	FieldControlDataAttributes["touched"] = "data-touched";
	/**
	* Present when the field's value has changed.
	*/
	FieldControlDataAttributes["dirty"] = "data-dirty";
	/**
	* Present when the field is filled.
	*/
	FieldControlDataAttributes["filled"] = "data-filled";
	/**
	* Present when the field control is focused.
	*/
	FieldControlDataAttributes["focused"] = "data-focused";
	return FieldControlDataAttributes;
}({});
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/internals/field-constants/constants.mjs
var DEFAULT_VALIDITY_STATE = {
	badInput: false,
	customError: false,
	patternMismatch: false,
	rangeOverflow: false,
	rangeUnderflow: false,
	stepMismatch: false,
	tooLong: false,
	tooShort: false,
	typeMismatch: false,
	valid: null,
	valueMissing: false
};
var DEFAULT_FIELD_STATE_ATTRIBUTES = {
	valid: null,
	touched: false,
	dirty: false,
	filled: false,
	focused: false
};
var DEFAULT_FIELD_ROOT_STATE = {
	disabled: false,
	...DEFAULT_FIELD_STATE_ATTRIBUTES
};
var fieldValidityMapping = { valid(value) {
	if (value === null) return null;
	if (value) return { [FieldControlDataAttributes.valid]: "" };
	return { [FieldControlDataAttributes.invalid]: "" };
} };
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var DEFAULT_FIELD_ROOT_CONTEXT = {
	invalid: void 0,
	name: void 0,
	validityData: {
		state: DEFAULT_VALIDITY_STATE,
		errors: [],
		error: "",
		value: "",
		initialValue: null
	},
	setValidityData: NOOP,
	disabled: void 0,
	touched: DEFAULT_FIELD_STATE_ATTRIBUTES.touched,
	setTouched: NOOP,
	dirty: DEFAULT_FIELD_STATE_ATTRIBUTES.dirty,
	setDirty: NOOP,
	filled: DEFAULT_FIELD_STATE_ATTRIBUTES.filled,
	setFilled: NOOP,
	focused: DEFAULT_FIELD_STATE_ATTRIBUTES.focused,
	setFocused: NOOP,
	validate: () => null,
	validationMode: "onSubmit",
	validationDebounceTime: 0,
	shouldValidateOnChange: () => false,
	state: DEFAULT_FIELD_ROOT_STATE,
	markedDirtyRef: { current: false },
	registerFieldControl: NOOP,
	validation: {
		getValidationProps: (_disabled, props = EMPTY_OBJECT) => props,
		inputRef: { current: null },
		registerInput: NOOP,
		commit: async () => {},
		change: NOOP
	}
};
var FieldRootContext = /*#__PURE__*/ import_react.createContext(DEFAULT_FIELD_ROOT_CONTEXT);
FieldRootContext.displayName = "FieldRootContext";
function useFieldRootContext(optional = true) {
	const context = import_react.useContext(FieldRootContext);
	if (context.setValidityData === NOOP && !optional) throw new Error("Base UI: FieldRootContext is missing. Field parts must be placed within <Field.Root>.");
	return context;
}
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/internals/form-context/FormContext.mjs
var FormContext = /*#__PURE__*/ import_react.createContext({
	formRef: { current: { fields: /* @__PURE__ */ new Map() } },
	errors: {},
	clearErrors: NOOP,
	validationMode: "onSubmit",
	submitAttemptedRef: { current: false }
});
FormContext.displayName = "FormContext";
function useFormContext() {
	return import_react.useContext(FormContext);
}
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs
/**
* A context for providing [labelable elements](https://html.spec.whatwg.org/multipage/forms.html#category-label)\
* with an accessible name (label) and description.
*/
var LabelableContext = /*#__PURE__*/ import_react.createContext({
	controlId: void 0,
	registerControlId: NOOP,
	labelId: void 0,
	setLabelId: NOOP,
	messageIds: [],
	setMessageIds: NOOP,
	getDescriptionProps: (externalProps) => externalProps
});
LabelableContext.displayName = "LabelableContext";
function useLabelableContext() {
	return import_react.useContext(LabelableContext);
}
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/internals/labelable-provider/useLabelableId.mjs
function useLabelableId(params = {}) {
	const { id, implicit = false, controlRef } = params;
	const { controlId, registerControlId } = useLabelableContext();
	const defaultId = useBaseUiId(id);
	const controlIdForEffect = implicit ? controlId : void 0;
	const controlSourceRef = useRefWithInit(() => Symbol("labelable-control"));
	const hasRegisteredRef = import_react.useRef(false);
	const hadExplicitIdRef = import_react.useRef(id != null);
	const unregisterControlId = useStableCallback(() => {
		if (!hasRegisteredRef.current || registerControlId === NOOP) return;
		hasRegisteredRef.current = false;
		registerControlId(controlSourceRef.current, void 0);
	});
	useIsoLayoutEffect(() => {
		if (registerControlId === NOOP) return;
		let nextId;
		if (implicit) {
			const elem = controlRef?.current;
			if (isElement(elem) && elem.closest("label") != null) nextId = id ?? null;
			else nextId = controlIdForEffect ?? defaultId;
		} else if (id != null) {
			hadExplicitIdRef.current = true;
			nextId = id;
		} else if (hadExplicitIdRef.current) nextId = defaultId;
		else {
			unregisterControlId();
			return;
		}
		if (nextId === void 0) {
			unregisterControlId();
			return;
		}
		hasRegisteredRef.current = true;
		registerControlId(controlSourceRef.current, nextId);
	}, [
		id,
		controlRef,
		controlIdForEffect,
		registerControlId,
		implicit,
		defaultId,
		controlSourceRef,
		unregisterControlId
	]);
	import_react.useEffect(() => {
		return unregisterControlId;
	}, [unregisterControlId]);
	return controlId ?? defaultId;
}
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/internals/field-register-control/useRegisterFieldControl.mjs
function useRegisterFieldControl(controlRef, id, value, getFormValueOverride, enabled = true, name) {
	const { registerFieldControl } = useFieldRootContext();
	const sourceRef = import_react.useRef(null);
	if (!sourceRef.current) sourceRef.current = Symbol();
	useIsoLayoutEffect(() => {
		const source = sourceRef.current;
		if (!source || !enabled) return;
		registerFieldControl(source, {
			controlRef,
			getValue: getFormValueOverride,
			id,
			name,
			value
		});
		return () => {
			registerFieldControl(source, void 0);
		};
	}, [
		controlRef,
		enabled,
		getFormValueOverride,
		id,
		name,
		registerFieldControl,
		value
	]);
}
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/field/control/FieldControl.mjs
/**
* The form control to label and validate.
* Renders an `<input>` element.
*
* You can omit this part and use any Base UI input component instead. For example,
* [Input](https://base-ui.com/react/components/input), [Checkbox](https://base-ui.com/react/components/checkbox),
* or [Select](https://base-ui.com/react/components/select), among others, will work with Field out of the box.
*
* Documentation: [Base UI Field](https://base-ui.com/react/components/field)
*/
var FieldControl = /*#__PURE__*/ import_react.forwardRef(function FieldControl(componentProps, forwardedRef) {
	const { render, className, id: idProp, name: nameProp, value: valueProp, disabled: disabledProp = false, onValueChange, defaultValue, autoFocus = false, style, ...elementProps } = componentProps;
	const { state: fieldState, name: fieldName, disabled: fieldDisabled, setTouched, setDirty, validityData, setFocused, setFilled, validationMode, validation } = useFieldRootContext();
	const { clearErrors } = useFormContext();
	const disabled = fieldDisabled || disabledProp;
	const name = fieldName ?? nameProp;
	const state = {
		...fieldState,
		disabled
	};
	const { labelId } = useLabelableContext();
	const id = useLabelableId({ id: idProp });
	useIsoLayoutEffect(() => {
		const hasExternalValue = valueProp != null;
		if (validation.inputRef.current?.value || hasExternalValue && valueProp !== "") setFilled(true);
		else if (hasExternalValue && valueProp === "") setFilled(false);
	}, [
		validation.inputRef,
		setFilled,
		valueProp
	]);
	const inputRef = import_react.useRef(null);
	useIsoLayoutEffect(() => {
		if (autoFocus && inputRef.current === activeElement(ownerDocument(inputRef.current))) setFocused(true);
	}, [autoFocus, setFocused]);
	const [valueUnwrapped] = useControlled({
		controlled: valueProp,
		default: defaultValue,
		name: "FieldControl",
		state: "value"
	});
	const isControlled = valueProp !== void 0;
	const value = isControlled ? valueUnwrapped : void 0;
	const getValueFromInput = useStableCallback(() => validation.inputRef.current?.value);
	useRegisterFieldControl(validation.inputRef, id, value, getValueFromInput, !disabled, nameProp);
	return useRenderElement("input", componentProps, {
		ref: [forwardedRef, inputRef],
		state,
		props: [
			{
				id,
				disabled,
				name,
				ref: validation.inputRef,
				"aria-labelledby": labelId,
				autoFocus,
				...isControlled ? { value } : { defaultValue },
				onChange(event) {
					const inputValue = event.currentTarget.value;
					onValueChange?.(inputValue, createChangeEventDetails(none, event.nativeEvent));
					setDirty(inputValue !== validityData.initialValue);
					setFilled(inputValue !== "");
					if (!event.nativeEvent.defaultPrevented) {
						clearErrors(name);
						validation.change(inputValue);
					}
				},
				onFocus() {
					setFocused(true);
				},
				onBlur(event) {
					setTouched(true);
					setFocused(false);
					if (validationMode === "onBlur") validation.commit(event.currentTarget.value);
				},
				onKeyDown(event) {
					if (event.currentTarget.tagName === "INPUT" && event.key === "Enter") {
						setTouched(true);
						validation.commit(event.currentTarget.value);
					}
				}
			},
			elementProps,
			(props) => validation.getValidationProps(disabled, props)
		],
		stateAttributesMapping: fieldValidityMapping
	});
});
FieldControl.displayName = "FieldControl";
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.6.0_@types_c8f7023997591cb572c9c100768f98b0/node_modules/@base-ui/react/input/Input.mjs
var import_jsx_runtime = require_jsx_runtime();
var Input = /*#__PURE__*/ import_react.forwardRef(function Input(props, forwardedRef) {
	return /*#__PURE__*/ (0, import_jsx_runtime.jsx)(FieldControl, {
		ref: forwardedRef,
		...props
	});
});
Input.displayName = "Input";
//#endregion
export { Input };

import {Renderer, TagProps} from "./index";

declare module "./index" {
	interface EventMap extends GlobalEventHandlersEventMap {}
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// TODO: refine/explain the NO_TOUCH set
// Gleaned from:
// https://github.com/preactjs/preact/blob/05e5d2c0d2d92c5478eeffdbd96681c96500d29f/src/diff/props.js#L111-L117
const NO_TOUCH = new Set(["form", "list", "type", "size"]);

export class DOMRenderer extends Renderer<Element, Node, undefined> {
	create<TTag extends string | symbol>(
		tag: TTag,
		props: unknown,
		children: unknown,
		ns: string | undefined,
	): Element {
		if (typeof tag !== "string") {
			throw new Error(`Unknown tag: ${tag.toString()}`);
		}

		if (tag === "svg") {
			ns = SVG_NAMESPACE;
		}

		if (ns !== undefined) {
			return document.createElementNS(ns, tag);
		}

		return document.createElement(tag);
	}

	patch<TTag extends string | symbol>(
		tag: TTag,
		el: Element,
		props: TagProps<TTag>,
		ns: string | undefined,
	): void {
		for (const name in props) {
			const value = props[name];
			switch (name) {
				case "children":
					break;
				case "class":
				case "className": {
					if (value == null) {
						el.removeAttribute("class");
					} else if (ns === undefined) {
						el.className = value;
					} else {
						el.setAttribute("class", value);
					}

					break;
				}
				case "style": {
					const style: CSSStyleDeclaration = (el as any).style;
					if (style == null) {
						el.setAttribute("style", value);
					} else {
						if (value == null) {
							el.removeAttribute("style");
						} else if (typeof value === "string") {
							style.cssText = value;
						} else {
							for (const styleName in value) {
								const styleValue = value && value[styleName];
								if (styleValue == null) {
									style.removeProperty(styleName);
								} else {
									style.setProperty(styleName, styleValue);
								}
							}
						}
					}

					break;
				}
				default: {
					if (ns === undefined && name in el && !NO_TOUCH.has(name)) {
						(el as any)[name] = value;
					} else if (value === true) {
						el.setAttribute(name, "");
					} else if (value === false || value == null) {
						el.removeAttribute(name);
					} else {
						el.setAttribute(name, value);
					}
				}
			}
		}

		if ("innerHTML" in props) {
			(el as any).__crankInnerHTML = "innerHTML" in props;
		} else if ((el as any).__crankInnerHTML) {
			(el as any).__crankInnerHTML = false;
		}
	}

	arrange<TTag extends string | symbol>(
		tag: TTag,
		el: Element | undefined,
		children: Array<Node | string>,
	): undefined {
		if (el === undefined) {
			throw new Error("Missing root");
		}

		if (
			!(el as any).__crankInnerHTML &&
			(children.length !== 0 || (el as any).__crankArranged)
		) {
			if (children.length === 0) {
				el.textContent = "";
				return;
			}

			let oldChild = el.firstChild;
			let i = 0;
			while (oldChild !== null && i < children.length) {
				const newChild = children[i];
				if (oldChild === newChild) {
					oldChild = oldChild.nextSibling;
					i++;
				} else if (typeof newChild === "string") {
					if ((oldChild as any).splitText !== undefined) {
						oldChild.nodeValue = newChild;
						oldChild = oldChild.nextSibling;
					} else {
						el.insertBefore(document.createTextNode(newChild), oldChild);
					}

					i++;
				} else if ((oldChild as any).splitText !== undefined) {
					const nextSibling = oldChild.nextSibling;
					el.removeChild(oldChild);
					oldChild = nextSibling;
				} else {
					el.insertBefore(newChild, oldChild);
					i++;
					// TODO: this is an optimization for the js frameworks benchmark swap rows, but we need to think a little more about other pathological cases.
					if (oldChild !== children[i]) {
						const nextSibling = oldChild.nextSibling;
						el.removeChild(oldChild);
						oldChild = nextSibling;
					}
				}
			}

			while (oldChild !== null) {
				const nextSibling = oldChild.nextSibling;
				el.removeChild(oldChild);
				oldChild = nextSibling;
			}

			for (; i < children.length; i++) {
				const newChild = children[i];
				el.appendChild(
					typeof newChild === "string"
						? document.createTextNode(newChild)
						: newChild,
				);
			}
			(el as any).__crankArranged = children.length > 0;
		}

		return undefined; // void :(
	}

	destroy(tag: string | symbol, el: Element) {
		if (el.parentNode !== null) {
			el.parentNode.removeChild(el);
		}
	}

	scope<TTag extends string | symbol>(
		tag: TTag,
		props: Record<string, any>,
		scope: string | undefined,
	): string | undefined {
		switch (tag) {
			case "svg":
				return SVG_NAMESPACE;
			case "foreignObject":
				return undefined;
			default:
				return scope;
		}
	}

	escape(text: string): string {
		return text;
	}

	parse(text: string): DocumentFragment {
		if (typeof document.createRange === "function") {
			return document.createRange().createContextualFragment(text);
		} else {
			const fragment = document.createDocumentFragment();
			const childNodes = new DOMParser().parseFromString(text, "text/html").body
				.childNodes;
			for (let i = 0; i < childNodes.length; i++) {
				fragment.appendChild(childNodes[i]);
			}

			return fragment;
		}
	}
}

export const renderer = new DOMRenderer();

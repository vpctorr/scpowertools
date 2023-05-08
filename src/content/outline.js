import { PDFHexString } from 'pdf-lib';
const walk = (outlines, callback // stop walking to children if returned false
) => {
    for (const outline of outlines) {
        const ret = callback(outline);
        if ('children' in outline && ret !== false)
            walk(outline.children, callback);
    }
};
const flatten = (outlines) => {
    const result = [];
    walk(outlines, (outline) => void result.push(outline));
    return result;
};
const getOpeningCount = (outlines) => {
    let count = 0;
    walk(outlines, (outline) => {
        count += 1;
        return !('open' in outline && !outline.open);
    });
    return count;
};
export const setOutline = async (doc, outlines) => {
    // Refs
    const rootRef = doc.context.nextRef();
    const refMap = new WeakMap();
    for (const outline of flatten(outlines)) {
        refMap.set(outline, doc.context.nextRef());
    }
    const pageRefs = (() => {
        const refs = [];
        doc.catalog.Pages().traverse((kid, ref) => {
            var _a;
            if (((_a = kid.get(kid.context.obj('Type'))) === null || _a === void 0 ? void 0 : _a.toString()) === '/Page') {
                refs.push(ref);
            }
        });
        return refs;
    })();
    // Outlines
    const createOutline = (outlines, parent) => {
        const { length } = outlines;
        for (let i = 0; i < length; i += 1) {
            const outline = outlines[i];
            const outlineRef = refMap.get(outline);
            const destOrAction = (() => {
                // if (typeof outline.to === 'string') {
                //   // URL
                //   return { A: { S: 'URI', URI: PDFHexString.fromText(outline.to) } }
                // } else
                if (typeof outline.to === 'number') {
                    return { Dest: [pageRefs[outline.to], 'Fit'] };
                }
                else if (Array.isArray(outline.to)) {
                    const page = doc.getPage(outline.to[0]);
                    const width = page.getWidth();
                    const height = page.getHeight();
                    return {
                        Dest: [
                            pageRefs[outline.to[0]],
                            'XYZ',
                            width * outline.to[1],
                            height * outline.to[2],
                            null,
                        ],
                    };
                }
                return {};
            })();
            const childrenDict = (() => {
                if ('children' in outline && outline.children.length > 0) {
                    createOutline(outline.children, outlineRef);
                    return {
                        First: refMap.get(outline.children[0]),
                        Last: refMap.get(outline.children[outline.children.length - 1]),
                        Count: getOpeningCount(outline.children) * (outline.open ? 1 : -1),
                    };
                }
                return {};
            })();
            doc.context.assign(outlineRef, doc.context.obj(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ Title: PDFHexString.fromText(outline.title), Parent: parent }, (i > 0 ? { Prev: refMap.get(outlines[i - 1]) } : {})), (i < length - 1 ? { Next: refMap.get(outlines[i + 1]) } : {})), childrenDict), destOrAction), { F: (outline.italic ? 1 : 0) | (outline.bold ? 2 : 0) })));
        }
    };
    createOutline(outlines, rootRef);
    // Root
    const rootCount = getOpeningCount(outlines);
    doc.context.assign(rootRef, doc.context.obj(Object.assign(Object.assign({ Type: 'Outlines' }, (rootCount > 0
        ? {
            First: refMap.get(outlines[0]),
            Last: refMap.get(outlines[outlines.length - 1]),
        }
        : {})), { Count: rootCount })));
    doc.catalog.set(doc.context.obj('Outlines'), rootRef);
};

import { XMLParser } from "fast-xml-parser";

const parseOptions = {
    // базовые опции
    ignoreAttributes: false, // не игнорировать атрибуты
    attributeNamePrefix: "", // имена атрибутов без префикса @_
    allowBooleanAttributes: true,
    parseAttributeValue: true,
    parseTagValue: true,

    // чтобы DataObject/Variable всегда были массивами
    isArray: (tagName /*, jpath: string*/) =>
        tagName === "DataObject" || tagName === "Variable",
};

export function parseXml(xmlString) {
    const parser = new XMLParser(parseOptions);
    const json = parser.parse(xmlString);

    const picked = [];
    (function walk(node) {
        if (node == null || typeof node !== "object") return;

        for (const [key, value] of Object.entries(node)) {
            if (key === "DataObject" || key === "Variable") {
                if (Array.isArray(value))
                    value.forEach((v) => picked.push(v.id));
                else picked.push(value.id);
            }
            if (value && typeof value === "object") walk(value);
        }
    })(json);

    return picked;
}

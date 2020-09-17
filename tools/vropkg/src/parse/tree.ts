import * as glob from "glob";
import * as path from "path";
import * as winston from 'winston';
import * as t from "../types";
import { read, stringToCategory, xml, xmlGet, xmlToAction, xmlChildNamed, xmlToTag } from "./util";
import { exist} from "../util";


function parseTreeElement(elementInfoPath: string): t.VroNativeElement {
    let info = xml(read(elementInfoPath));

    let categoryPath = stringToCategory(xmlGet(info, "categoryPath"));
    let id = xmlGet(info, "id");
    let type = t.VroElementType[xmlGet(info, "type")];
    let name = xmlGet(info, "name");
    let attributes = {};
    let dataFilePath = elementInfoPath.replace(".element_info.xml", ".xml");
    let bundleFilePath = elementInfoPath.replace(".element_info.xml", ".bundle.zip");
    let elementTagPath = elementInfoPath.replace(".element_info.xml", ".tags.xml");
    let elementInputFormPath = elementInfoPath.replace(".element_info.xml", ".form.json");
    let infoXml = xml(read(elementInfoPath));
    let description  = xmlGet(infoXml, "description");
    let comment = xmlChildNamed(infoXml, "comment");
    let form = null;
    let tags : Array<string>= [];
    let action : t.VroActionData = null;

    // Tags are optional
    if(exist(elementTagPath)){
        const tagsContent = read(elementTagPath);
        if (tagsContent.trim() !== '') {
            const tagsXml = exist(elementTagPath) && xml(tagsContent);
            tags = tags.concat(xmlToTag(tagsXml));
        }
    }

    // Form only for WF
    if(exist(elementInputFormPath)){
        form = JSON.parse(read(elementInputFormPath));
    }

    if (type == t.VroElementType.ResourceElement) {
        attributes = <t.VroNativeResourceElementAttributes>{
            id: xmlGet(info, "id"),
            name: xmlGet(info, "name"),
            version: xmlGet(info, "version") || "0.0.0",
            mimetype: xmlGet(info, "mimetype"),
            description: xmlGet(info, "description") || "",
            allowedOperations: "vf" // There is no information in NativeFolder. Using defaults
        }
        dataFilePath = dataFilePath.replace(".xml", "");
    } else if (type == t.VroElementType.ScriptModule) {
        name = xml(read(dataFilePath)).attr.name;
        action = xmlToAction(dataFilePath, bundleFilePath, name, comment, description, tags);
    }

    return <t.VroNativeElement>{ categoryPath, type, id, name, description, attributes, dataFilePath, tags, action, form };
}


async function parseTree(nativeFolderPath: string): Promise<t.VroPackageMetadata> {

    let pomXml = xml(read(path.join(nativeFolderPath, "pom.xml")))

    let elements = glob
        .sync(path.join(nativeFolderPath, "**", "*.element_info.xml"))
        .map(file => parseTreeElement(file)
        );

    let result = <t.VroPackageMetadata>{
        groupId: pomXml.descendantWithPath("groupId").val,
        artifactId: pomXml.descendantWithPath("artifactId").val,
        version: pomXml.descendantWithPath("version").val,
        packaging: pomXml.descendantWithPath("packaging").val,
        description: pomXml.descendantWithPath("description")?.val || "",
        elements: elements
    }
    return result;
}

export { parseTree };

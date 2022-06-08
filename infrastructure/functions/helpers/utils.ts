import * as Constant from './Constants';
import {
    client
} from './gremlinConnection';

export function addOwner(name) {
    return client.submit("g.addV(label).property('" + Constant.partitionKey + "', '" + Constant.partitionKey + "')", {
        label: "" + name + ""
    });
}

export function addBussinessEntity(cag, property, label, ownerName) {
    let typeValue = Constant.bussinessEntityPlaceHolder;
    return client.submit("g.addV('" + label + "').property('owner', owner).property('id', id)" + property + ".property('" + Constant.partitionKey + "', '" + Constant.partitionKey + "').property('type', type)", {
        id: "" + cag + "",
        type: "" + typeValue + "",
        owner: "" + ownerName + ""
    });
}

export function addRelationship(parentId, childId, relationship) {
    return client.submit("g.V(source).addE(relationship).to(g.V(target))", {
        source: "" + parentId + "",
        relationship: "" + relationship + "",
        target: "" + childId + ""
    }).then(function (result) {
        console.log("Result Edge: %s\n", JSON.stringify(result));
    });
}

export function getQueryResult(query) {
    return client.submit(query);
}

export function validateOwner(queryResponse) {
    if (queryResponse == null && queryResponse == undefined) {
        return "Owner doesn't exists";
    }

    if (queryResponse.outV !== 'Owners') {
        return "Invalid owner";
    }
}

export async function recursiveAddConfigCategory(configurationCategory, ownerIdName, parentId) {
    if (configurationCategory != null || configurationCategory != undefined) {
        // Loop through Configuration
        for (var i = 0, l = configurationCategory.length; i < l; i++) {
            var configCategory = configurationCategory[i];
            // Add Configuration
            let response = await addConfigurationCategory(configCategory, ownerIdName).then(function (result) {
                return result._items[0];
            });

            await addRelationship(parentId, response.id, ownerIdName);
            let configs = configCategory.configs;
            if (configs != null || configs != undefined) {
                await addConfigurations(configs, response.id, ownerIdName);
            }
            await recursiveAddConfigCategory(configCategory.subcategories, ownerIdName, response.id)
        }
    }
}
/** 
    Validate Configuration Category.
    1) Either add Configuration or SubCategory
    2) ConfigurationCategory depth is greater than 3
    3) Only 20 Configurations allowed
*/
export async function validateConfigCategory(configCategories, depth) {
    if (configCategories != null || configCategories != undefined) {
        for (var i = 0, l = configCategories.length; i < l; i++) {
            var configCategory = configCategories[i];

            if ((configCategory.configs != null || configCategory.configs != undefined) && configCategory.subcategories != null) {
                throw new Error("Invalid Configuration. Either add Configuration or SubCategory :" + configCategory.name);
            }
            if (depth > 3) {
                throw new Error("ConfigurationCategory depth is greater than 3 :" + configCategory.name);
            }
            if (configCategory.configs != null || configCategory.configs != undefined) {
                if (configCategory.configs.length > 20) {
                    throw new Error("Configurations length is greater than 20. Only 20 Configurations allowed. :" + configCategory.name);
                }
            }
            if ((configCategory.startDate != null || configCategory.startDate != undefined || (configCategory.endDate != null || configCategory.endDate != undefined))) {
                let startDate = dateAndTimeValidation(configCategory.startDate);
                let endDate = dateAndTimeValidation(configCategory.endDate);
                if (startDate == false || endDate == false) {
                    throw new Error("Format Must be DD/MM/YYYY HH:MM:SS or DD/MM/YYYY");
                }
            }
            await validateConfigCategory(configCategory.subcategories, depth + 1)
        }
    }
}

export function dateAndTimeValidation(date) {
    var patternForDateAndTime = /^(((0[1-9]|[12]\d|3[01])[\/\.-](0[13578]|1[02])[\/\.-]((19|[2-9]\d)\d{2})\s(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]))|((0[1-9]|[12]\d|30)[\/\.-](0[13456789]|1[012])[\/\.-]((19|[2-9]\d)\d{2})\s(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]))|((0[1-9]|1\d|2[0-8])[\/\.-](02)[\/\.-]((19|[2-9]\d)\d{2})\s(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]))|((29)[\/\.-](02)[\/\.-]((1[6-9]|[2-9]\d)(0[48]|[2468][048]|[13579][26])|((16|[2468][048]|[3579][26])00))\s(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])))$/g;
    var patternForDate = /(^(((0[1-9]|1[0-9]|2[0-8])[\/](0[1-9]|1[012]))|((29|30|31)[\/](0[13578]|1[02]))|((29|30)[\/](0[4,6,9]|11)))[\/](19|[2-9][0-9])\d\d$)|(^29[\/]02[\/](19|[2-9][0-9])(00|04|08|12|16|20|24|28|32|36|40|44|48|52|56|60|64|68|72|76|80|84|88|92|96)$)/gm;
    if (date == null || date == undefined || date == "") {
        return true;
    }
    else if (patternForDateAndTime.test(date)) {
        return true;
    }
    else if (patternForDate.test(date)) {
        return true;
    }
    else {
        return false;
    }
}

export function addConfigurationCategory(configurationCategory, ownerIdName) {
    let properties = configurationCategory.properties;
    let propertyString = createPropertyObjectSting(properties);
    return client.submit("g.addV(label).property('owner', owner).property('startingDate', startDate).property('endingDate', endDate).property('type', type)" + propertyString + ".property('" + Constant.partitionKey + "', '" + Constant.partitionKey + "')", {
        label: "" + configurationCategory.name + "",
        type: "" + Constant.configCategoryType + "",
        owner: "" + ownerIdName + "",
        startDate: "" + configurationCategory.startDate + "",
        endDate: "" + configurationCategory.endDate + "",
    });
}

export function createPropertyObjectSting(properties) {
    var property = new String("");
    for (let key in properties) {
        let ruleObject = properties[key];
        property = property.concat('.property(').concat("'" + ruleObject.name + "',").concat("'" + ruleObject.value + "')");
    }
    return property;
}

export function addConfig(owner, configs) {
    let configString = createPropertyObjectSting(configs);
    return client.submit("g.addV(label).property('owner', owner).property('type', type)" + configString + ".property('" + Constant.partitionKey + "', '" + Constant.partitionKey + "')", {
        label: "" + Constant.configurationType + "",
        owner: "" + owner + "",
        type: "" + Constant.configurationType + "",
    });
}

export async function addConfigurations(configs, id, ownerIdName) {
    let response = await addConfig(ownerIdName, configs).then(function (result) {
        return result._items[0];
    });
    await addRelationship(id, response.id, ownerIdName);
}
/**
 * Build Configuration Category object from the Gremlin Vertice
 * Used in Query Response
 */
export function buildConfigurationCategoryResponse(obj: any) {
    let response = {}
    let propertiesResponse = [];
    let properties = obj.properties;
    response[Constant.idPlaceHolder] = obj.id;
    response[Constant.namePlaceholder] = obj.label;
    for (let key in properties) {
        if (key == Constant.partitionKey) {
            continue;
        }
        if (key == Constant.ownerPlaceHolder) {
            response[Constant.ownerPlaceHolder] = properties[key][0].value;
            continue;
        }
        if (key == Constant.typePlaceholder) {
            response[Constant.typePlaceholder] = properties[key][0].value;
            continue;
        }

        let property = {};
        property[Constant.namePlaceholder] = key;
        property[Constant.valuePlaceHolder] = properties[key][0].value;
        propertiesResponse.push(property);
    };

    response[Constant.propertiesPlaceHolder] = propertiesResponse
    return response;
}
/**
 * Build Configuration object from the Gremlin Vertice
 * Used in Query Response
 */
export function buildConfiguration(obj) {
    let response = {}
    let configurations = [];
    let properties = obj.properties;

    response[Constant.idPlaceHolder] = obj.id;
    for (let key in properties) {

        if (key == Constant.partitionKey) {
            continue;
        }

        if (key == Constant.ownerPlaceHolder) {
            continue;
        }
        if (key == Constant.typePlaceholder) {
            response[Constant.typePlaceholder] = properties[key][0].value;
            continue;
        }
        let configuration = {};
        configuration[Constant.namePlaceholder] = key;
        configuration[Constant.valuePlaceHolder] = properties[key][0].value;
        configuration[Constant.idPlaceHolder] = properties[key][0].id;
        configurations.push(configuration);
    };

    response[Constant.configsPlaceHolder] = configurations;
    return response;
}
/**
 * Build Query response based on configCategoryName and configurationName
 * @param configCategoriesResponse 
 * @param configCategoryName 
 * @param configurationName 
 * @returns 
 */
export async function buildQueryResponse(configCategoriesResponse: any[], configCategoryName: any, configurationName: String) {

    if ((configCategoryName != undefined && configCategoryName != null)) {
        configCategoriesResponse = configCategoriesResponse.filter(a => a.name == configCategoryName)
    }

    if ((configurationName != undefined && configurationName != null)) {
        let configCategoryFilter = [];
        for (var i = 0, l = configCategoriesResponse.length; i < l; i++) {
            const name = configCategoriesResponse[i].name
            let config = await getConfigurations(configCategoriesResponse[i], configurationName);
            if (config != null || config != undefined) {
                configCategoryFilter.push(name);
            }
        }
        configCategoriesResponse = configCategoriesResponse.filter(item => configCategoryFilter.includes(item.name))
    }

    return configCategoriesResponse;
}

export async function getConfigurations(configCategory, configurationName) {
    if (configCategory.subcategories != null || configCategory.subcategories != undefined) {
        let configRes = await getConfigurations(configCategory.subcategories, configurationName);
        if (configRes != null && configRes != undefined) {
            return configCategory;
        }
    }
    if (configCategory != null || configCategory != undefined) {
        // Loop through Configuration
        for (var i = 0, l = configCategory.length; i < l; i++) {
            if (configCategory[i].subcategories != null || configCategory[i].subcategories != undefined) {

                let configRes = await getConfigurations(configCategory[i].subcategories, configurationName);
                if (configRes != null && configRes != undefined) {
                    return configCategory[i];
                }
            } else if (configCategory[i].configs != undefined || configCategory[i].configs != null) {
                let configs = configCategory[i].configs.filter(a => a.name == configurationName);
                if (configs.length != 0) {
                    configCategory[i].configs = configs;
                    return configCategory[i];
                } else {
                    return null;
                }

            }
        }
    }

}
export async function updateConfigurationCategoryObjectRecursively(configCategory, edge, configCategoryObj) {
    if (configCategory != null && configCategory != undefined) {
        if (configCategory.id == edge[0].outV) {
            if (configCategoryObj.type == Constant.configCategoryType) {
                let subcategories = configCategory.subcategories || [];
                subcategories.push(configCategoryObj)
                configCategory.subcategories = subcategories;
            } else if (configCategoryObj.type == Constant.configurationType) {
                configCategory.configs = configCategoryObj.configs;
            }

            return configCategory;
        }
        for (var i = 0, l = configCategory.length; i < l; i++) {
            let child = configCategory[i];
            if (child.id == edge[0].outV) {
                if (configCategoryObj.type == Constant.configCategoryType) {
                    let subcategories = child.subcategories || [];
                    subcategories.push(configCategoryObj)
                    child.subcategories = subcategories;
                } else if (configCategoryObj.type == Constant.configurationType) {
                    child.configs = configCategoryObj.configs;
                }
                return child;
            }
            let configRes = await updateConfigurationCategoryObjectRecursively(child.subcategories, edge, configCategoryObj);
            if (configRes != null && configRes != undefined) {
                return configRes;
            }
        }
    }
}

export async function addVertice(query) {
    return client.submit(query + ".property('" + Constant.partitionKey + "', '" + Constant.partitionKey + "')");
}

export async function deleteOwner(id) {
    return client.submit("g.V(id).property('" + Constant.isDeletedPlaceHolder + "',true)", {
        id: "" + id + ""
    });
}


export async function deleteBussinessEntity(id) {
    return client.submit("g.V(id).emit().repeat(out()).fold().unfold().property('" + Constant.isDeletedPlaceHolder + "',true)", {
        id: "" + id + ""
    });
}

export async function deleteConfigurationProperty(id, Property) {
    return client.submit("g.V(id)" + Property + ".property('" + Constant.isDeletedPlaceHolder + "',true)", {
        id: "" + id + ""
    });
}

export async function updateConfigurationProperty(id, properties) {
    return client.submit("g.V(id)" + properties + "", {
        id: "" + id + ""
    });
}


export async function updatePropertyForValue(id, properties) {
    return client.submit("g.V(id)" + properties + "", {
        id: "" + id + ""
    });
}

export async function updatePropertyForNameAndValue(id, labelName) {
    return client.submit("g.V(id).property(Cardinality.single,'label',Name)", {
        id: "" + id + "",
        Name: "" + labelName + "",
    });
}

export async function ownerVAlidationForDelete(id) {
    let query = 'g.V("Owners")';
    let resultQuery;
    await client.submit(query).then(function (result) {
        resultQuery = result._items[0];
    });

    if (resultQuery == null || resultQuery == undefined) {
        return "Owners Vertice doesn't exists";
    }

    let queryForOwnerID = 'g.V("' + id + '").bothE()';
    let queryResponse = await getQueryResult(queryForOwnerID).then(function (result) {
        return result._items[0];
    });
    let inValidOwner = validateOwner(queryResponse);
    if (inValidOwner != null && inValidOwner != undefined) {
        return inValidOwner;
    }
}

export async function UpdateProperty(queryResponse, configurationId, properties) {
    var property = new String("");
    var oldLableNameForDelete = new String("");
    const configuration = queryResponse.properties.type.map(p => p.value)
    for (let key in properties) {
        let propertyObject = properties[key]
        if ((propertyObject.name == "type" || propertyObject.name == "lable" || propertyObject.name == "pk" || propertyObject.name == "id") || (propertyObject.currentPropertyName == "type" || propertyObject.currentPropertyName == "lable" || propertyObject.currentPropertyName == "pk" || propertyObject.currentPropertyName == "id" || propertyObject.currentPropertyName == "startingDate" || propertyObject.currentPropertyName == "endingDate")) {
            return Constant.InvalidInputPlaceHolder;
        }
        let query = 'g.V("' + configurationId + '").properties("' + propertyObject.name + '")';
        let queryResponse = await getQueryResult(query).then(function (result) {
            return result._items[0];
        });
        if (propertyObject.currentPropertyName == undefined || propertyObject.currentPropertyName == null) {
            if (queryResponse != undefined) {
                let checkDate = propertyObject.name
                if (checkDate == "startingDate" || checkDate == "endingDate" && configuration == Constant.configurationCategoryPlaceHolder) {
                    let date = dateAndTimeValidation(propertyObject.value)
                    if (date == false) {
                        throw new Error("Format Must be DD/MM/YYYY HH:MM:SS or DD/MM/YYYY");
                    }
                }
                property = property.concat('.optional(has(').concat("'" + propertyObject.name + "'").concat(").property(Cardinality.single,'" + propertyObject.name + "','" + propertyObject.value + "'))");
            } else {
                return Constant.InvalidInputPlaceHolder;
            }
        } else if (propertyObject.currentPropertyName != undefined || propertyObject.currentPropertyName != null) {
            let query = 'g.V("' + configurationId + '").properties("' + propertyObject.currentPropertyName + '")';
            let queryResponse = await getQueryResult(query).then(function (result) {
                return result._items[0];
            });
            const lableCheck = queryResponse.label
            if (lableCheck == null || lableCheck == undefined) {
                return Constant.InvalidInputPlaceHolder;
            }
            if (lableCheck == propertyObject.currentPropertyName && lableCheck == propertyObject.name) {
                property = property.concat(".property('" + propertyObject.name + "','" + propertyObject.value + "')");
            }
            else if (propertyObject.currentPropertyName == lableCheck && propertyObject.name == lableCheck) {
                property = property.concat('.optional(has(').concat("'" + propertyObject.name + "'").concat(").property(Cardinality.single,'" + propertyObject.name + "','" + propertyObject.value + "'))");
            }
            else if (queryResponse != null || queryResponse != undefined) {
                property = property.concat('.optional(has(').concat("'" + propertyObject.currentPropertyName + "'").concat(").property(Cardinality.single,'" + propertyObject.name + "','" + propertyObject.value + "'))");
                oldLableNameForDelete = oldLableNameForDelete.concat("'" + propertyObject.currentPropertyName + "'").concat(',');
            } else {
                return Constant.InvalidInputPlaceHolder;
            }
        }
    }
    if (oldLableNameForDelete.length != 0) {
        property = property.concat('.properties(').concat("" + oldLableNameForDelete + ").drop()");
    }
    await updatePropertyForValue(configurationId, property).then(function (result) {
        return result._items[0];
    });
    return Constant.SuccessfulPlaceHolder;
}



import {
    client
} from './gremlinConnection';
import * as Constant from './Constants';
import * as utils from './utils';



export default {
    Query: {

        async getConfigByName(_, { bussinessEntity, configCategoryName, configurationName }: { bussinessEntity: String, configCategoryName: String, configurationName: String }) {
            let query = 'g.V("' + bussinessEntity + '").repeat(outE().inV()).until(outE().count().is(0)).path()';

            let resultQuery;
            await client.submit(query).then(function (result) {
                resultQuery = result._items;
            });
            let response = {};
            if (resultQuery == null || resultQuery == undefined || resultQuery.length == 0) {
                query = 'g.V("' + bussinessEntity + '")';
                let queryResponse = await utils.getQueryResult(query).then(function (result) {
                    return result._items[0];
                });
                if (queryResponse == null || queryResponse == undefined || queryResponse.length == 0) {
                    return null;
                }
                let properties = queryResponse.properties;
                response[Constant.idPlaceHolder] = queryResponse.id;
                response[Constant.typePlaceholder] = queryResponse.label;
                let propertiesResponse = [];

                for (let key in properties) {
                    let property = {};
                    if (key == Constant.partitionKey || key == Constant.typePlaceholder) {
                        continue;
                    }
                    if (key == Constant.ownerPlaceHolder) {
                        response[Constant.ownerPlaceHolder] = properties[key][0].value;
                        continue;
                    }
                    property[Constant.namePlaceholder] = key;
                    property[Constant.valuePlaceHolder] = properties[key][0].value;
                    propertiesResponse.push(property);
                };

                response[Constant.propertiesPlaceHolder] = propertiesResponse
                return response;
            }

            let configCategoriesResponse = [];
            let edges = [];
            for (let responseArray in resultQuery) {
                for (let key in resultQuery[responseArray].objects) {
                    let obj = resultQuery[responseArray].objects[key];
                    let propertiesResponse = [];
                    if (obj.type == 'edge') {
                        edges.push(obj);
                        continue;
                    }
                    let properties = obj.properties;
                    const type = properties[Constant.typePlaceholder][0].value;
                    if (type == Constant.bussinessEntityPlaceHolder) {
                        response[Constant.idPlaceHolder] = obj.id;
                        response[Constant.typePlaceholder] = obj.label;
                        let properties = obj.properties;
                        for (let key in properties) {
                            let property = {};
                            if (key == Constant.partitionKey || key == Constant.typePlaceholder) {
                                continue;
                            }
                            if (key == Constant.ownerPlaceHolder) {
                                response[Constant.ownerPlaceHolder] = properties[key][0].value;
                                continue;
                            }
                            property[Constant.namePlaceholder] = key;
                            property[Constant.valuePlaceHolder] = properties[key][0].value;
                            propertiesResponse.push(property);
                        };

                        response[Constant.propertiesPlaceHolder] = propertiesResponse
                    } else {
                        const edge = edges.filter(e => e.inV == obj.id);
                        if (type == Constant.configCategoryType) {
                            let ignore = configCategoriesResponse.filter(configCategoryResponse => configCategoryResponse.id == obj.id);
                            if (ignore.length > 0) {
                                continue;
                            }
                            let configCategoryObj = utils.buildConfigurationCategoryResponse(obj);

                            const objIndex = configCategoriesResponse.findIndex((a => a.id == edge[0].outV));
                            let found = false;
                            if (objIndex >= 0) {
                                let subcategories = configCategoriesResponse[objIndex].subcategories || [];
                                subcategories.push(configCategoryObj)
                                configCategoriesResponse[objIndex].subcategories = subcategories;
                                found = true;
                            } else {
                                for (var j = 0, l = configCategoriesResponse.length; j < l; j++) {
                                    let configCategory = configCategoriesResponse[j].subcategories;
                                    let res = await utils.updateConfigurationCategoryObjectRecursively(configCategory, edge, configCategoryObj);
                                    if (res != null || res != undefined) {
                                        found = true;
                                    }
                                }
                            }
                            if (!found) {
                                configCategoriesResponse.push(configCategoryObj);
                            }

                        } else if (type == Constant.configurationType) {
                            let configuration = utils.buildConfiguration(obj);
                            for (var j = 0, l = configCategoriesResponse.length; j < l; j++) {
                                if (configCategoriesResponse[j].subcategories != null || configCategoriesResponse[j].subcategories != undefined) {
                                    let subcategories = configCategoriesResponse[j].subcategories;
                                    await utils.updateConfigurationCategoryObjectRecursively(subcategories, edge, configuration);
                                } else {
                                    configCategoriesResponse[j].configs = configuration[Constant.configsPlaceHolder];
                                }
                            }
                        }
                    }
                }
            }
            let configCategoryRes = await utils.buildQueryResponse(configCategoriesResponse, configCategoryName, configurationName);
            response['configCategories'] = configCategoryRes;

            return response;
        }
    },

    Mutation: {

        async AddBussinessEntity(_, { businessEntity }) {

            var property = new String("");
            var cag = new String("");
            const id = businessEntity.id;
            const ownerId = businessEntity.owner;
            // Check if Owner exists
            let ownerQuery = 'g.V("' + ownerId + '").bothE()';
            let queryResponse = await utils.getQueryResult(ownerQuery).then(function (result) {
                return result._items[0];
            });
            let ownerName;
            let inValidOwner = utils.validateOwner(queryResponse);
            if (inValidOwner != null && inValidOwner != undefined) {
                // If it is skyline or cag ingestion owner definded in key vault, Add Owner with name and id
                if (Constant.skyLineOwnerID == ownerId || Constant.cagIngestionOwnerID == ownerId) {

                    if (ownerId == Constant.skyLineOwnerID) {
                        ownerName = Constant.skyLineOwnerName;
                    } else {
                        ownerName = Constant.cagIngestionOwnerName
                    }
                    let query = "g.addV('" + ownerName + "').property(id, '" + ownerId + "')";
                    let res = await utils.addVertice(query).then(function (result) {
                        return result._items[0];
                    });
                    await validateAndAddOwnersVertice();
                    await utils.addRelationship("Owners", res.id, "has");
                } else {
                    return inValidOwner;
                }
            } else {
                ownerName = queryResponse.inVLabel;
            }

            let properties = businessEntity.properties || [];
            if (businessEntity.properties != null || businessEntity.properties != undefined) {
                for (let key in properties) {
                    let propertyObject = properties[key];
                    property = property.concat('.property(').concat("'" + propertyObject.name + "',").concat("'" + propertyObject.value + "')");
                }
            }

            const cagIds = ['LegalEntityIdentifier', 'CustomerAccountIdentifier', 'OrganizationPopulationGroupNumber'];
            let legalEntityIdentifier = properties.filter(i => 'LegalEntityIdentifier' === i.name);
            let customerAccountIdentifier = properties.filter(i => 'CustomerAccountIdentifier' === i.name);
            let organizationPopulationGroupNumber = properties.filter(i => 'OrganizationPopulationGroupNumber' === i.name);
            let label;
            if (id != null || id != undefined) {
                cag = id;
                label = id;
            } else if (legalEntityIdentifier.length != 0 && customerAccountIdentifier.length != 0 && organizationPopulationGroupNumber.length != 0) {
                cag = cag.concat(legalEntityIdentifier[0].value.trim()).concat('-').concat(customerAccountIdentifier[0].value.trim()).concat('-').concat(organizationPopulationGroupNumber[0].value.trim());
                label = 'CAG'
            }

            let query = 'g.V("' + cag + '")';
            let resultQuery;
            await client.submit(query).then(function (result) {
                resultQuery = result._items[0];
            });

            if (resultQuery != null || resultQuery != undefined) {
                return "Business Entity already exist";
            }
            await utils.addBussinessEntity(cag, property, label, ownerName);
            return "SUCCESS";
        },

        async AddOwner(_, { ownerName }: { ownerName: string }) {

            await validateAndAddOwnersVertice();

            let response = await utils.addOwner(ownerName).then(function (result) {
                return result._items[0];
            });

            await utils.addRelationship("Owners", response.id, "has");

            return response.id;
        },

        async AddBussinessEntityWithConfig(_, { businessEntity }) {
            const parentId = businessEntity.id;
            const ownerId = businessEntity.owner;

            // Check if Owner exists
            let query = 'g.V("' + ownerId + '").bothE()';
            let queryResponse = await utils.getQueryResult(query).then(function (result) {
                return result._items[0];
            });

            let inValidOwner = utils.validateOwner(queryResponse);
            if (inValidOwner != null && inValidOwner != undefined) {
                return inValidOwner;
            }

            query = 'g.V("' + parentId + '")';
            let businessEntityRes = await utils.getQueryResult(query).then(function (result) {
                return result._items[0];
            });
            if (businessEntityRes == null || businessEntityRes == undefined || businessEntityRes.length == 0) {
                return "Business Entity not found";
            }
            // Validate Input
            let ownerIdName = queryResponse.inVLabel;
            let configCategories = businessEntity.configCategories;

            try {
                // Validate Configuration Category
                await utils.validateConfigCategory(configCategories, 0);
            } catch (err) {
                return err.message
            }
            await utils.recursiveAddConfigCategory(configCategories, ownerIdName, parentId);

            return "SUCCESS";
        },
        async DeleteOwner(_, { ownerId }: { ownerId: string }) {
            let query = 'g.V("' + ownerId + '").bothE()';
            let queryResponse = await utils.getQueryResult(query).then(function (result) {
                return result._items[0];
            });
            try {
                let ownerIdNameOutVLabel = queryResponse.outVLabel;
                if (ownerIdNameOutVLabel == Constant.ownersPlaceHolder) {
                    await utils.deleteOwner(ownerId).then(function (result) {
                        return result._items[0];
                    });
                    return "SUCCESS";
                } else {
                    return "In Valid Owner Id";
                }
            } catch (error) {
                return error.message;
            }

        },
        async DeleteBussinessEntity(_, { businessEntityId }) {
            const businessId = businessEntityId.businessEntityId
            const ownerId = businessEntityId.ownerId;
            if ((ownerId == null || ownerId == undefined) || (businessId == null || businessId == undefined)) {
                return Constant.InvalidInputPlaceHolder;
            }
            let ownerValidation = await utils.ownerVAlidationForDelete(ownerId)
            if (ownerValidation != undefined || ownerValidation != null) {
                return ownerValidation;
            }
            let query = 'g.V("' + businessId + '")';
            let queryResponse = await utils.getQueryResult(query).then(function (result) {
                return result._items[0];
            });
            try {
                if (queryResponse != null || queryResponse != undefined) {
                    const businessEntityFromPropertiesType = queryResponse.properties.type.map(p => p.value)
                    if (businessEntityFromPropertiesType == Constant.bussinessEntityPlaceHolder) {
                        await utils.deleteBussinessEntity(businessId).then(function (result) {
                            return result._items[0];
                        });
                        return Constant.SuccessfulPlaceHolder;
                    } else {
                        return "In Valid Bussiness Entity Id";
                    }
                }
            } catch (error) {
                return error.message;
            }
        },
        async DeleteBussinessEntityWithConfig(_, { configurationCategory }) {
            const configurationCategoryId = configurationCategory.configurationCategoryId
            const ownerId = configurationCategory.ownerId;
            if ((ownerId == null || ownerId == undefined) || (configurationCategoryId == null || configurationCategoryId == undefined)) {
                return Constant.InvalidInputPlaceHolder;
            }
            let ownerValidation = await utils.ownerVAlidationForDelete(ownerId)
            if (ownerValidation != undefined || ownerValidation != null) {
                return ownerValidation;
            }
            let query = 'g.V("' + configurationCategoryId + '")';
            let queryResponse = await utils.getQueryResult(query).then(function (result) {
                return result._items[0];
            });
            try {
                if (queryResponse != null || queryResponse != undefined) {
                    const ownerCheck = queryResponse.properties.owner.map(p => p.id)
                    const configurationCategoryFromPropertiesType = queryResponse.properties.type.map(p => p.value)
                    if (configurationCategoryFromPropertiesType == Constant.configurationCategoryPlaceHolder && ownerCheck != undefined || ownerCheck != null) {
                        let query = 'g.V("' + configurationCategoryId + '").In()';
                        let queryResponse = await utils.getQueryResult(query).then(function (result) {
                            return result._items[0];
                        });
                        if (queryResponse != null || queryResponse != undefined) {
                            const businessEntityFromPropertiesType = queryResponse.properties.type.map(p => p.value)
                            if (businessEntityFromPropertiesType == Constant.bussinessEntityPlaceHolder) {
                                await utils.deleteBussinessEntity(configurationCategoryId).then(function (result) {
                                    return result._items[0];
                                });
                                return Constant.SuccessfulPlaceHolder;
                            } if (businessEntityFromPropertiesType == Constant.configurationCategoryPlaceHolder) {
                                return Constant.InvalidInputPlaceHolder;
                            }
                        }
                    }
                }
            } catch (error) {
                return error.message;
            }
        },
        async DeleteConfigurationProperty(_, { deleteConfigurationProperty }) {
            var property = new String("");
            var propertyName = new String("");
            const ownerId = deleteConfigurationProperty.ownerId;
            const configurationId = deleteConfigurationProperty.configurationId;
            const properties = deleteConfigurationProperty.properties;
            if ((ownerId == null || ownerId == undefined) || (configurationId == null || configurationId == undefined) || (properties == null || properties == undefined)) {
                return Constant.InvalidInputPlaceHolder;
            }
            let ownerValidation = await utils.ownerVAlidationForDelete(ownerId)
            if (ownerValidation != undefined || ownerValidation != null) {
                return ownerValidation;
            }
            let query = 'g.V("' + configurationId + '")';
            let queryResponse = await utils.getQueryResult(query).then(function (result) {
                return result._items[0];
            });
            try {
                if (queryResponse != null || queryResponse != undefined) {
                    const ownerCheck = queryResponse.properties.owner.map(p => p.id)
                    const configuration = queryResponse.properties.type.map(p => p.value)
                    for (let key in properties) {
                        let propertyObject = properties[key]
                        let query = 'g.V("' + configurationId + '").properties("' + propertyObject.name + '")';
                        let queryResponse = await utils.getQueryResult(query).then(function (result) {
                            return result._items[0];
                        });
                        if (propertyObject.id == queryResponse.id && configuration == Constant.configurationPlaceHolder && ownerCheck != undefined || null) {
                            propertyName = propertyName.concat("'" + propertyObject.name + "'").concat(',');
                        }
                        else if (propertyObject.id == null && configuration == Constant.configurationPlaceHolder && ownerCheck != undefined || null) {
                            propertyName = propertyName.concat("'" + propertyObject.name + "'").concat(',');
                        }
                        else if (propertyObject.id != queryResponse.id) {
                            return Constant.InvalidInputPlaceHolder;
                        } else {
                            return "Unsuccessful";
                        }
                    }
                    property = property.concat('.properties(').concat("" + propertyName + ")");
                    await utils.deleteConfigurationProperty(configurationId, property).then(function (result) {
                        return result._items[0];
                    });
                    return Constant.SuccessfulPlaceHolder;
                }
            } catch (error) {
                return error.message;
            }
        },
        async UpdateBussinessEntity(_, { businessEntityInputForUpdate }) {
            const ownerId = businessEntityInputForUpdate.ownerId;
            const businessEntityId = businessEntityInputForUpdate.businessEntityId;
            const properties = businessEntityInputForUpdate.properties;
            if ((ownerId == null || ownerId == undefined) || (businessEntityId == null || businessEntityId == undefined) || (properties == null || properties == undefined)) {
                return Constant.InvalidInputPlaceHolder;
            }
            let ownerValidation = await utils.ownerVAlidationForDelete(ownerId)
            if (ownerValidation != undefined || ownerValidation != null) {
                return ownerValidation;
            }
            let query = 'g.V("' + businessEntityId + '")';
            let queryResponse = await utils.getQueryResult(query).then(function (result) {
                return result._items[0];
            });
            try {
                if (queryResponse != null || queryResponse != undefined) {
                    let result = await utils.UpdateProperty(queryResponse, businessEntityId, properties);
                    return result;
                }
                return Constant.InvalidInputPlaceHolder;
            } catch (error) {
                return error.message;
            }
        },
        async UpdateCategory(_, { categoryInputForUpdate }) {
            const ownerId = categoryInputForUpdate.ownerId;
            const configurationCategoryId = categoryInputForUpdate.categoryId;
            const properties = categoryInputForUpdate.properties;
            if ((ownerId == null || ownerId == undefined) || (configurationCategoryId == null || configurationCategoryId == undefined) || (properties == null || properties == undefined)) {
                return Constant.InvalidInputPlaceHolder;
            }
            let ownerValidation = await utils.ownerVAlidationForDelete(ownerId)
            if (ownerValidation != undefined || ownerValidation != null) {
                return ownerValidation;
            }
            let query = 'g.V("' + configurationCategoryId + '")';
            let queryResponse = await utils.getQueryResult(query).then(function (result) {
                return result._items[0];
            });
            try {
                if (queryResponse != null || queryResponse != undefined) {
                    let result = await utils.UpdateProperty(queryResponse, configurationCategoryId, properties);
                    return result;
                }
                return Constant.InvalidInputPlaceHolder;
            } catch (error) {
                return error.message;
            }
        },
        async UpdateConfigurationProperty(_, { configurationInputForUpdate }) {
            const configurationId = configurationInputForUpdate.configurationId;
            const ownerId = configurationInputForUpdate.ownerId;
            const properties = configurationInputForUpdate.properties;
            if ((ownerId == null || ownerId == undefined) || (configurationId == null || configurationId == undefined) || (properties == null || properties == undefined)) {
                return Constant.InvalidInputPlaceHolder;
            }
            let ownerValidation = await utils.ownerVAlidationForDelete(ownerId)
            if (ownerValidation != undefined || ownerValidation != null) {
                return ownerValidation;
            }
            let query = 'g.V("' + configurationId + '")';
            let queryResponse = await utils.getQueryResult(query).then(function (result) {
                return result._items[0];
            });
            try {
                if (queryResponse != null || queryResponse != undefined) {
                    let result = await utils.UpdateProperty(queryResponse, configurationId, properties);
                    return result;
                }
                return Constant.InvalidInputPlaceHolder;
            } catch (error) {
                return error.message;
            }
        },
    }
}

async function validateAndAddOwnersVertice() {
    let query = 'g.V("Owners")';
    let resultQuery;
    await client.submit(query).then(function (result) {
        resultQuery = result._items[0];
    });

    if (resultQuery == null || resultQuery == undefined) {
        query = "g.addV('Owners').property(id, 'Owners')";
        await utils.addVertice(query);
    }
}


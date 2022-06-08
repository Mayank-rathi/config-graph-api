import { loadFilesSync } from "@graphql-tools/load-files";
import { mergeTypeDefs } from "@graphql-tools/merge";
const path = require('path');


const pathSchema = path.join(__dirname, "/schemas");
console.log("pathSchema====>", pathSchema);
const types = loadFilesSync(pathSchema, { extensions: ['graphql'] });
export default mergeTypeDefs(types);
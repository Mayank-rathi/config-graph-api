const gremlin = require('gremlin');

const endpoint = process.env['GREMLIN_DB_ENDPOINT']; 
const database = process.env['GREMLIN_DB_NAME']; 
const primaryKey = process.env['GREMLIN_DB_PRIMARYKEY']; 
const collection = process.env['GREMLIN_DB_COLLECTION']; 

const authenticator = new gremlin.driver.auth.PlainTextSaslAuthenticator(
    `/dbs/${database}/colls/${collection}`, 
    primaryKey
)


export const client = new gremlin.driver.Client(
    endpoint, 
    { 
        authenticator,
        traversalsource : "g",
        rejectUnauthorized : true,
        mimeType : "application/vnd.gremlin-v2.0+json"
    }
);



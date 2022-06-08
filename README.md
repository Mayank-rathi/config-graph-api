# config-graph-api
Config Graph API

### Prerequisite
    Node version 14

### Run Local
	npm run build:prod
	npm run fnStart

### Publish
	npm run build:prod
	npm run publish:fn

### Important Configurations
	"GREMLIN_DB_ENDPOINT": Gremlin DB endpoint URL,
    "GREMLIN_DB_PRIMARYKEY": Gremlin DB Primary Key,
    "GREMLIN_DB_NAME": Gremlin DB Name,
    "GREMLIN_DB_COLLECTION": Gremlin DB Collection,
    "APOLLO_INTROSPECTION": set false for all enviornment
    "SKYLINE_OWNER" : "Skyline",
    "SKYLINE_OWNER_ID" : "Owner id for skyline",
    "CAG_INGESTION_LOADER_OWNER" : "Cag ingestion loader",
    "CAG_INGESTION_LOADER_OWNER_ID" : "Owner id for cag ingestion service"

### Important Notes
    CAG_INGESTION_LOADER_OWNER_ID should match with [config-cag-ingestion-service](https://github.optum.com/orx-dsg-mbr/config-cag-ingestion-service) configuration
    SKYLINE_OWNER_ID should match with [config-service-data-load](https://github.optum.com/orx-dsg-mbr/config-service-data-load) configuration


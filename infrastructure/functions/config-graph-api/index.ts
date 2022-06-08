import { ApolloServer } from "apollo-server-azure-functions";
import resolvers from "../helpers/resolvers";
import typeDefs from "../helpers/typedefs";


console.log("Starting Apollo server New ====>");
const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: process.env['APOLLO_INTROSPECTION'] === 'true'
});


export default server.createHandler()
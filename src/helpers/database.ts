import {Collection} from "discord.js";
import {
    MongoClient,
    Collection as MongoCollection,
    Document,
    UpdateFilter,
    ClientSession,
    OptionalUnlessRequiredId,
} from "mongodb";
import {Config} from "../config";
import {logger} from "../logger";
import {Query} from "../types";

let mongoClient: MongoClient;
const collectionCache = new Collection<string, MongoCollection<any>>();

export const teamCollection = "teams";
export const categoryCollection = "team_categories";
export const verifiedCollection = "users";
export const inviteCollection = "invites";

// HACK: Create actual schema type instead of using MongoDB's base Document type

export const AuthenticateMongo = async () => {
    mongoClient = new MongoClient(Config.mongo_db.database_url, {
        cert: Config.mongo_db.certificate,
        key: Config.mongo_db.private_key,
    });

    await mongoClient.connect();
    process.addListener("beforeExit", () => {
        mongoClient.close();
    });
};

export const GetClient = async <T>(name: string) => {
    if (Config.dev_mode) {
        name += "_development";
    }

    // try cache
    const cached = collectionCache.get(name);
    if (cached) {
        return cached as MongoCollection<T>;
    }

    // cache miss, find existing collection in database
    const db = mongoClient.db(Config.teams.database_name);
    const collections = await db.listCollections({name: name}).toArray();

    let collection;

    // create new collection if it doesn't exist
    if (collections.length == 0) {
        collection = await db.createCollection<T>(name);
    } else {
        collection = db.collection<T>(name);
    }

    // add collection into cache for fast access in the future
    collectionCache.set(name, collection);
    return collection;
};

// Performs an operation under the safety of a transaction. Auto-commits after operation success.
export const WithTransaction = async (
    operation: {
        (session: ClientSession): Promise<string>;
    },
    rollback?: {(error: string): Promise<void>}
): Promise<string> => {
    const session = mongoClient.startSession();
    rollback = rollback ?? (async (_) => {});

    try {
        session.startTransaction();

        // try to complete the operation, if it errors catch and abort
        const error = await operation(session);
        if (error) {
            throw new Error(error);
        }

        await session.commitTransaction();
        return "";
    } catch (err) {
        if (session.inTransaction()) {
            try {
                await Promise.allSettled([
                    rollback(`${err}`),
                    session.abortTransaction(),
                ]);
            } catch (err) {
                logger.warn(`Error while rolling back transaction: ${err}`);
            }
        }
        return `${err}`;
    } finally {
        await session.endSession();
    }
};

export const CountEntities = async (collection: string): Promise<number> => {
    const db = await GetClient(collection);
    return await db.estimatedDocumentCount();
};

// inserts a document into the named collection
export const InsertOne = async <T>(
    collection: string,
    toInsert: OptionalUnlessRequiredId<T>,
    options?: Partial<{session: ClientSession}>
): Promise<boolean> => {
    const db = await GetClient<T>(collection);
    let result;
    try {
        result = await db.insertOne(toInsert, {session: options?.session});
    } catch (err) {
        logger.error(`Inserting ${JSON.stringify(toInsert)} failed: ${err}`);
        return false;
    }

    return result.acknowledged;
};

// returns a document matching the query inside the named collection
export const FindOne = async <T>(
    collection: string,
    query: Query<T>,
    options?: Partial<{session: ClientSession}>
): Promise<T | null> => {
    const db = await GetClient<T>(collection);

    const result = await db.findOne(query, {session: options?.session});
    return result as T | null;
};

// finds and replaces a document matching the query inside the named collection
export const FindAndReplace = async <T>(
    collection: string,
    find: T | Query<T>,
    replaceWith: T,
    options?: Partial<{session: ClientSession; required: boolean}>
): Promise<boolean> => {
    const db = await GetClient<T>(collection);
    const result = await db.findOneAndReplace(find, replaceWith, {
        session: options?.session,
    });

    return !!result.ok || !(options?.required ?? true);
};

// finds a document and applies the update to it
export const FindAndUpdate = async <T>(
    collection: string,
    find: T | Query<T>,
    update: UpdateFilter<T> | Partial<T>,
    options?: Partial<{session: ClientSession; required: boolean; upsert: boolean}>
): Promise<boolean> => {
    const upsert = options?.upsert ?? false;
    const db = await GetClient<T>(collection);
    const result = await db.updateOne(find, update, {
        upsert: upsert,
        session: options?.session,
    });

    return !!result.acknowledged || !(options?.required ?? true);
};

export const FindAndUpdateAll = async <T>(
    collection: string,
    find: T | Query<T>,
    update: UpdateFilter<T>,
    options?: Partial<{session: ClientSession; required: boolean}>
) => {
    const db = await GetClient<T>(collection);
    const result = await db.updateMany(find, update, {session: options?.session});
    return (
        (!!result.acknowledged && result.matchedCount !== 0) ||
        !(options?.required ?? true)
    );
};

// finds and removes a document matching the query from the named collection
export const FindAndRemove = async <T>(
    collection: string,
    toDelete: T | Query<T>,
    options?: Partial<{session: ClientSession; required: boolean}>
): Promise<boolean> => {
    const db = await GetClient<T>(collection);
    const result = await db.findOneAndDelete(toDelete, {session: options?.session});

    return !!result.ok && (result.value !== null || !(options?.required ?? true));
};

package database

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoConfig holds MongoDB connection configuration
type MongoConfig struct {
	Host       string
	Port       string
	User       string
	Password   string
	Database   string
	Collection string
	AuthDB     string // Default: admin
}

// MongoConnection wraps MongoDB connection
type MongoConnection struct {
	Client     *mongo.Client
	Database   *mongo.Database
	Collection *mongo.Collection
	Config     MongoConfig
}

// MongoConnect establishes MongoDB connection
func MongoConnect(config MongoConfig) (*MongoConnection, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Build connection URI
	var uri string
	if config.User != "" && config.Password != "" {
		authDB := config.AuthDB
		if authDB == "" {
			authDB = "admin"
		}
		uri = fmt.Sprintf("mongodb://%s:%s@%s:%s/%s?authSource=%s",
			config.User, config.Password, config.Host, config.Port, config.Database, authDB)
	} else {
		uri = fmt.Sprintf("mongodb://%s:%s", config.Host, config.Port)
	}

	// Set client options
	clientOptions := options.Client().ApplyURI(uri)

	// Connect
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping to verify connection
	if err = client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	db := client.Database(config.Database)
	var collection *mongo.Collection
	if config.Collection != "" {
		collection = db.Collection(config.Collection)
	}

	return &MongoConnection{
		Client:     client,
		Database:   db,
		Collection: collection,
		Config:     config,
	}, nil
}

// Close closes MongoDB connection
func (c *MongoConnection) Close() error {
	if c.Client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return c.Client.Disconnect(ctx)
	}
	return nil
}

// ExecuteFind executes a find query and returns results as slice of maps
func (c *MongoConnection) ExecuteFind(collectionName string, filter bson.M) ([]map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	collection := c.Database.Collection(collectionName)
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("MongoDB find failed: %w", err)
	}
	defer cursor.Close(ctx)

	var results []map[string]interface{}
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			return nil, fmt.Errorf("failed to decode document: %w", err)
		}

		// Convert bson.M to map[string]interface{}
		row := make(map[string]interface{})
		for k, v := range doc {
			row[k] = v
		}
		results = append(results, row)
	}

	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("cursor error: %w", err)
	}

	return results, nil
}

// ExecuteAggregate runs an aggregation pipeline
func (c *MongoConnection) ExecuteAggregate(collectionName string, pipeline []bson.M) ([]map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	collection := c.Database.Collection(collectionName)
	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("MongoDB aggregation failed: %w", err)
	}
	defer cursor.Close(ctx)

	var results []map[string]interface{}
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			return nil, fmt.Errorf("failed to decode document: %w", err)
		}

		row := make(map[string]interface{})
		for k, v := range doc {
			row[k] = v
		}
		results = append(results, row)
	}

	return results, nil
}

// InsertMany inserts multiple documents into a collection
func (c *MongoConnection) InsertMany(collectionName string, documents []map[string]interface{}) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	collection := c.Database.Collection(collectionName)

	// Convert to []interface{}
	docs := make([]interface{}, len(documents))
	for i, doc := range documents {
		docs[i] = doc
	}

	_, err := collection.InsertMany(ctx, docs)
	if err != nil {
		return fmt.Errorf("MongoDB insert failed: %w", err)
	}

	return nil
}

// TestMongoConnection tests MongoDB connectivity
func TestMongoConnection(config MongoConfig) error {
	conn, err := MongoConnect(config)
	if err != nil {
		return err
	}
	defer conn.Close()
	return nil
}

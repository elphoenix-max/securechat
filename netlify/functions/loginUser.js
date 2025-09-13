const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Elphoenix:Wejsrenvrai@securechat.dpxhgbg.mongodb.net/securechat';

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { userCode, password } = JSON.parse(event.body);

    // Validation des données
    if (!userCode || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Code utilisateur et mot de passe requis' 
        })
      };
    }

    const client = await connectToDatabase();
    const db = client.db('securechat');
    const collection = db.collection('users');

    // Trouver l'utilisateur par son code
    const user = await collection.findOne({ code: userCode });
    
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Code utilisateur invalide' 
        })
      };
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Mot de passe incorrect' 
        })
      };
    }

    // Mettre à jour la dernière connexion
    await collection.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    // Retourner les données utilisateur (sans le mot de passe)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        user: {
          _id: user._id,
          username: user.username,
          code: user.code,
          createdAt: user.createdAt,
          lastLogin: new Date()
        }
      })
    };

  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Erreur serveur lors de la connexion',
        error: error.message 
      })
    };
  }
};
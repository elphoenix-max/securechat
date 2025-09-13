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

// Générer un code utilisateur unique
function generateUserCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
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
    const { username, password } = JSON.parse(event.body);

    // Validation des données
    if (!username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Nom d\'utilisateur et mot de passe requis' 
        })
      };
    }

    if (username.length < 3) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Le nom d\'utilisateur doit contenir au moins 3 caractères' 
        })
      };
    }

    if (password.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Le mot de passe doit contenir au moins 6 caractères' 
        })
      };
    }

    const client = await connectToDatabase();
    const db = client.db('securechat');
    const collection = db.collection('users');

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await collection.findOne({ username: username });
    if (existingUser) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Ce nom d\'utilisateur existe déjà' 
        })
      };
    }

    // Générer un code utilisateur unique
    let userCode;
    let codeExists = true;
    let attempts = 0;
    
    while (codeExists && attempts < 10) {
      userCode = generateUserCode();
      const existingCode = await collection.findOne({ code: userCode });
      codeExists = !!existingCode;
      attempts++;
    }

    if (codeExists) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Impossible de générer un code unique' 
        })
      };
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur
    const newUser = {
      username: username,
      password: hashedPassword,
      code: userCode,
      createdAt: new Date(),
      lastLogin: null
    };

    const result = await collection.insertOne(newUser);

    if (result.acknowledged) {
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Utilisateur créé avec succès',
          userCode: userCode
        })
      };
    } else {
      throw new Error('Failed to create user');
    }

  } catch (error) {
    console.error('Create user error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Erreur serveur lors de la création du compte',
        error: error.message 
      })
    };
  }
};
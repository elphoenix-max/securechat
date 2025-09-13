const { MongoClient } = require('mongodb');

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
    const { senderCode, receiverCode, encrypted, original } = JSON.parse(event.body);

    // Validation des données
    if (!senderCode || !receiverCode || !encrypted || !original) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Données manquantes (sender, receiver, encrypted, original)' 
        })
      };
    }

    if (senderCode === receiverCode) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Impossible d\'envoyer un message à soi-même' 
        })
      };
    }

    const client = await connectToDatabase();
    const db = client.db('securechat');
    const messagesCollection = db.collection('messages');
    const usersCollection = db.collection('users');

    // Vérifier que les utilisateurs existent
    const [sender, receiver] = await Promise.all([
      usersCollection.findOne({ code: senderCode }),
      usersCollection.findOne({ code: receiverCode })
    ]);

    if (!sender) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Expéditeur non trouvé' 
        })
      };
    }

    if (!receiver) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Destinataire non trouvé' 
        })
      };
    }

    // Créer le message
    const newMessage = {
      sender: senderCode,
      receiver: receiverCode,
      encrypted: encrypted,
      original: original,
      timestamp: new Date(),
      chatId: [senderCode, receiverCode].sort().join('_')
    };

    const result = await messagesCollection.insertOne(newMessage);

    if (result.acknowledged) {
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Message envoyé avec succès',
          messageId: result.insertedId.toString()
        })
      };
    } else {
      throw new Error('Failed to insert message');
    }

  } catch (error) {
    console.error('Send message error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Erreur serveur lors de l\'envoi',
        error: error.message 
      })
    };
  }
};
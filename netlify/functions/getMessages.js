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
    const { chatId } = JSON.parse(event.body);

    if (!chatId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Chat ID requis' })
      };
    }

    // Extraire les codes utilisateurs du chatId
    const participants = chatId.split('_');
    
    if (participants.length !== 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Format Chat ID invalide' })
      };
    }

    const client = await connectToDatabase();
    const db = client.db('securechat');
    const collection = db.collection('messages');

    // Récupérer tous les messages entre ces deux utilisateurs
    const messages = await collection.find({
      $or: [
        { sender: participants[0], receiver: participants[1] },
        { sender: participants[1], receiver: participants[0] }
      ]
    }).sort({ timestamp: 1 }).toArray();

    // Formatter les messages pour le frontend
    const formattedMessages = messages.map(message => ({
      id: message._id.toString(),
      sender: message.sender,
      receiver: message.receiver,
      encrypted: message.encrypted,
      original: message.original,
      timestamp: new Date(message.timestamp).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
  
      chatId: message.chatId
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedMessages)
    };

  } catch (error) {
    console.error('Get messages error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur serveur',
        message: error.message 
      })
    };
  }
};
// admin.routes.js (protected by admin authentication)
router.get('/database/stats', async (req, res) => {
    try {
      const stats = {
        collections: {},
        connectionStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      };
      
      // Get collection counts
      const collections = await mongoose.connection.db.listCollections().toArray();
      for (const collection of collections) {
        const count = await mongoose.connection.db.collection(collection.name).countDocuments();
        stats.collections[collection.name] = count;
      }
      
      return res.status(200).json({ success: true, data: stats });
    } catch (error) {
      logger.error('Error getting database stats:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  });
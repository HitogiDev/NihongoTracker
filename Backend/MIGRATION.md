# Database Migration Guide

## Overview

This guide explains how to apply database performance optimizations to NihongoTracker in different environments.

## Scripts Available

### Development

```bash
# Indexes are auto-created via Mongoose schema in development
# No manual script needed - indexes created automatically on app start

# Verify indexes (optional - for checking what was auto-created)
npm run verify:indexes
```

### Staging/Testing

```bash
# Migration script with safety checks
npm run migrate:indexes

# Verify indexes were created successfully
npm run verify:indexes
```

### Production

```bash
# Production migration with full safety measures
npm run migrate:indexes:prod

# Verify indexes after migration
npm run verify:indexes
```

## Index Management Strategy

### Development Environment

- Indexes are **automatically created** via Mongoose schema definitions
- Provides convenience during development
- Conditional index creation: `if (process.env.NODE_ENV === 'development')`
- No manual migration needed

### Production Environment

- Indexes are created via **controlled migration scripts**
- Better performance and reliability
- Full logging and error handling
- Idempotent operations (safe to run multiple times)
- Background index creation to avoid blocking operations

### Why Separate Strategies?

1. **Development**: Fast iteration with automatic index management
2. **Production**: Controlled, safe, and monitored index creation
3. **Performance**: Avoid startup delays in production
4. **Reliability**: Production indexes created with proper error handling

## Production Deployment

### Prerequisites

1. **Environment Variables**: Ensure `DATABASE_URL` or `MONGODB_URI` is set
2. **Database Access**: Verify connection to production MongoDB
3. **Backup**: Always backup your database before running migrations
4. **Monitoring**: Have database monitoring ready to watch performance

### Step-by-Step Production Deployment

1. **Backup Database**

   ```bash
   mongodump --uri="your-production-uri" --out=backup-$(date +%Y%m%d)
   ```

2. **Test on Staging First**

   ```bash
   NODE_ENV=staging npm run migrate:indexes
   ```

3. **Deploy to Production During Low Traffic**

   ```bash
   NODE_ENV=production npm run migrate:indexes:prod
   ```

4. **Monitor Performance**
   - Watch MongoDB metrics
   - Check application response times
   - Monitor memory and CPU usage

### What the Migration Does

The migration creates these performance indexes:

1. **`user_1_date_-1`** - User logs sorted by date
2. **`user_1_mediaId_1_type_1`** - Critical for MediaDetails page  
3. **`user_1_type_1_date_-1`** - User type filtering
4. **`user_1_mediaId_1_date_-1`** - User media timeline
5. **`mediaId_1_type_1`** - Media type queries
6. **`type_1_date_-1`** - Type-based queries
7. **`user_1_mediaId_1_type_1_date_-1`** - **CRITICAL**: Complete MediaDetails optimization (user + media + type + date sort)

### Index Verification

After running migrations, always verify indexes were created successfully:

```bash
npm run verify:indexes
```

This will show:

- ✅ Present indexes
- ❌ Missing indexes  
- ⚠️ Unexpected indexes

### Performance Impact

The critical compound index `user_1_mediaId_1_type_1_date_-1` specifically targets the slow MediaDetails queries:

- **Before**: 15-19 second response times
- **After**: Expected <1 second response times
- **Query optimized**: `GET /api/users/{username}/logs?mediaId={id}&type={type}`

### Safety Features

- **Background Index Creation**: Indexes are created in background mode to avoid blocking operations
- **Idempotent**: Safe to run multiple times - skips existing indexes
- **Retry Logic**: Automatically retries failed operations
- **Connection Timeout**: Prevents hanging connections
- **Detailed Logging**: Comprehensive logging for monitoring
- **Exit Codes**: Proper exit codes for automation

### Rollback Plan

If you need to remove the indexes:

```javascript
// Connect to your database and run:
db.logs.dropIndex("user_1_date_-1");
db.logs.dropIndex("user_1_mediaId_1_type_1");
db.logs.dropIndex("user_1_type_1_date_-1");
db.logs.dropIndex("user_1_mediaId_1_date_-1");
db.logs.dropIndex("mediaId_1_type_1");
db.logs.dropIndex("type_1_date_-1");
```

### Expected Performance Impact

- **Query Performance**: 90%+ reduction in query time for MediaDetails
- **Memory Usage**: Lower memory usage due to efficient queries
- **Concurrent Users**: Better handling of multiple simultaneous requests
- **Database Load**: Reduced CPU usage on database server

### Monitoring After Deployment

Watch these metrics:

- Average query response time
- Database CPU usage
- Memory consumption
- Index usage statistics

### Troubleshooting

**Common Issues:**

1. **Connection Timeout**
   - Increase `serverSelectionTimeoutMS` in the script
   - Check network connectivity

2. **Index Creation Fails**
   - Check disk space on database server
   - Verify user permissions
   - Review MongoDB logs

3. **Application Slowdown**
   - Index creation can temporarily slow writes
   - Monitor and wait for completion
   - Consider running during maintenance window

### CI/CD Integration

Add to your deployment pipeline:

```yaml
# Example GitHub Actions step
- name: Run Database Migration
  run: |
    npm run migrate:indexes:prod
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    NODE_ENV: production
```

## Support

If you encounter issues:

1. Check the script logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure database connectivity
4. Review MongoDB server logs for additional details

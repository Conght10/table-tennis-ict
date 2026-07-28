const fs = require('fs');
const filePath = './src/app/pages/evnict/domain/evnict-data.service.ts';

try {
    let content = fs.readFileSync(filePath, 'utf8');
    const apiUrl = process.env.API_URL || 'http://localhost:8084/api';
    
    console.log(`[set-env] Replacing API URL with: ${apiUrl}`);
    
    // Replace the apiUrl property declaration in evnict-data.service.ts
    content = content.replace(/private readonly apiUrl = [^;]+/g, `private readonly apiUrl = '${apiUrl}'`);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[set-env] API URL successfully updated in service file.');
} catch (error) {
    console.error('[set-env] Error updating API URL:', error);
}

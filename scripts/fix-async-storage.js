const fs = require('fs');
const path = require('path');

const targetPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@react-native-async-storage',
    'async-storage',
    'android',
    'testresults.gradle'
);

if (fs.existsSync(targetPath)) {
    const content = fs.readFileSync(targetPath, 'utf8');
    if (content.includes('import org.gradle.api.tasks.testing.logging.TestExceptionFormat')) {
        // Comment out everything
        const patchedContent = content
            .split('\n')
            .map(line => {
                if (!line.trim().startsWith('//')) {
                    return '// ' + line;
                }
                return line;
            })
            .join('\n');

        fs.writeFileSync(targetPath, patchedContent, 'utf8');
        console.log('Successfully patched testresults.gradle in @react-native-async-storage/async-storage');
    } else {
        console.log('testresults.gradle is already patched or format changed.');
    }
} else {
    console.log('testresults.gradle not found in @react-native-async-storage/async-storage. Skipping patch.');
}

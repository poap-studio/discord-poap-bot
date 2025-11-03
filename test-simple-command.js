import { config } from 'dotenv';
import { PoapAPI } from './src/poap-api.js';

config();

async function testCommand() {
    console.log('Testing the exact command flow...');
    
    const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    console.log(`Testing with address: ${testAddress}`);
    
    try {
        const poapAPI = new PoapAPI();
        console.log('1. POAP API initialized');
        
        console.log('2. Getting POAPs...');
        const poaps = await poapAPI.getUserPOAPs(testAddress);
        console.log(`✅ Found ${poaps.length} POAPs`);
        
        if (poaps.length > 0) {
            console.log('First few POAPs:');
            poaps.slice(0, 3).forEach((poap, i) => {
                console.log(`${i + 1}. ${poap.event.name} (${poap.created})`);
            });
        }
        
        console.log('✅ Test completed successfully');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    }
}

testCommand();
// Test script to verify password hashing
import { hashPassword, verifyPassword } from './workers/src/lib/auth-helpers'

async function testPassword() {
  const password = 'test123'
  const email = 'stepdadstrong@gmail.com'
  
  console.log('\nTesting password hashing for:', email)
  console.log('Password:', password)
  
  // Hash the password
  const hash = await hashPassword(password)
  console.log('\nGenerated hash:', hash)
  
  // Verify the password
  const isValid = await verifyPassword(password, hash)
  console.log('Verification result:', isValid)
  
  // Test with wrong password
  const wrongValid = await verifyPassword('wrongpassword', hash)
  console.log('Wrong password verification:', wrongValid)
}

testPassword().catch(console.error)

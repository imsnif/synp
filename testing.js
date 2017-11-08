const hex = '5faad9c2c07f60dd76770f71cf025b62a63cfd4e'
const base64 = 'sha1-X6rZwsB/YN12dw9xzwJbYqY8/U4='

console.log(hex === Buffer.from(base64, 'base64').toString('hex'))
console.log(base64 === Buffer.from(hex, 'hex').toString('base64'))
console.log(Buffer.from(hex, 'hex').toString('base64'))

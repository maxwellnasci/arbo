import sharp from 'sharp'

async function check() {
  const img = sharp('public/arbo-run-logo_1.png')
  const { data } = await img.raw().toBuffer()
  console.log(`Top-left pixel RGB: ${data[0]}, ${data[1]}, ${data[2]}`)
}

check()

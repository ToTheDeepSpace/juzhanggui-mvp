// Standalone health check — no dependencies
export default function handler(_req: any, res: any) {
  res.status(200).json({ success: true, message: 'OK', time: new Date().toISOString() });
}

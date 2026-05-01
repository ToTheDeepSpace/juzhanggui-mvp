import app from '../server/index';

// Vercel serverless handler
export default function handler(req: any, res: any) {
  return app(req, res);
}

import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
  res.render('expired', {
    user: req.user,
    active: null,
  });
});

export default router;

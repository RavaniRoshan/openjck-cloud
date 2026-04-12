import { Router } from 'express';
import { supabaseAdmin } from '../db.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    // Create organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: name.trim(),
        created_by: userId,
      })
      .select('id, name, created_by, created_at')
      .single();

    if (orgError) {
      console.error('Failed to create organization:', orgError);
      return res.status(500).json({ error: 'Failed to create organization' });
    }

    // Create organization member with owner role
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        user_id: userId,
        org_id: org.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('Failed to create organization member:', memberError);
      // Rollback: delete the organization if member creation fails
      await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      return res.status(500).json({ error: 'Failed to add user to organization' });
    }

    res.status(201).json({ org_id: org.id, name: org.name });
  } catch (err) {
    console.error('Org creation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

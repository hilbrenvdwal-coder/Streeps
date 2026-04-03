CREATE OR REPLACE FUNCTION cleanup_conversation_member_on_group_leave()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM conversation_members
  WHERE user_id = OLD.user_id
    AND conversation_id IN (
      SELECT id FROM conversations WHERE group_id = OLD.group_id
    );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_cleanup_conv_member
AFTER DELETE ON group_members
FOR EACH ROW
EXECUTE FUNCTION cleanup_conversation_member_on_group_leave();

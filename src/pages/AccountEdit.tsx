import { useParams } from "react-router-dom";
import AccountForm from "./AccountForm";

export default function AccountEdit() {
  const params = useParams();
  const id = params.id as string | undefined;
  return <AccountForm accountId={id || null} />;
}
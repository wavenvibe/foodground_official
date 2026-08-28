import StatePanel from "@/components/StatePanel";

export default function RecipeNotFound() {
  return (
    <main className="page-container">
      <StatePanel
        title="레시피를 찾을 수 없습니다"
        description="삭제되었거나 존재하지 않는 레시피입니다."
        actionHref="/recipes"
        actionLabel="레시피 검색으로"
      />
    </main>
  );
}

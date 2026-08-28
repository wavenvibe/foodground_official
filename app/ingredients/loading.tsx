import Footer from "@/components/Footer";
import Header from "@/components/Header";

export default function IngredientsLoading() {
  return (
    <div className="app-shell">
      <Header />
      <main className="page-container" aria-busy="true" aria-label="식재료 검색 결과 로딩 중">
        <div className="loading-block loading-block--title" />
        <div className="loading-block loading-block--filters" />
        <div className="resource-list resource-list--compact">
          {[0, 1, 2, 3].map((i) => (
            <div className="loading-card" key={i}>
              <div className="loading-block loading-block--short" />
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

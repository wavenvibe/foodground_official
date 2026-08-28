import Footer from "@/components/Footer";
import Header from "@/components/Header";

export default function RecipesLoading() {
  return (
    <div className="app-shell">
      <Header />
      <main className="page-container" aria-busy="true" aria-label="레시피 검색 결과 로딩 중">
        <div className="loading-block loading-block--title" />
        <div className="loading-block loading-block--filters" />
        <div className="resource-list">
          {[0, 1, 2].map((i) => (
            <div className="loading-card" key={i}>
              <div className="loading-block" />
              <div className="loading-block loading-block--short" />
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

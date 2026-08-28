import Footer from "@/components/Footer";
import Header from "@/components/Header";

export default function FacilitiesLoading() {
  return (
    <div className="app-shell">
      <Header />
      <main className="page-container" aria-busy="true" aria-label="제조시설 검색 결과 로딩 중">
        <div className="loading-block loading-block--title" />
        <div className="loading-block loading-block--filters" />
        <div className="facility-list">
          {[0, 1, 2].map((index) => (
            <div className="loading-card" key={index}>
              <div className="loading-block" />
              <div className="loading-block loading-block--short" />
              <div className="loading-block" />
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

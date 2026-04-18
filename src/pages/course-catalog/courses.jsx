import Header from "../../components/Header";
import Footer from "../../components/Footer";
import CourseCard from "../../components/course-card";
import SearchBar from "../../components/search-bar";
import CourseCounter from "../../components/course-counter";

const Courses = () => {
  const courses = []; 

  return (
    <div>
      <Header />

      <SearchBar searchTerm="" onSearch={() => {}} />

      <CourseCounter total={courses.length} />

      <div>
        {courses.map((course, index) => (
          <CourseCard
            key={index}
            title={course.title}
            category={course.category}
            price={course.price}
          />
        ))}
      </div>

      <Footer />
    </div>
  );
};

export default Courses;